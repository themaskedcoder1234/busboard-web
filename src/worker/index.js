const { Worker } = require('bullmq')
const { createClient } = require('@supabase/supabase-js')
const IORedis = require('ioredis')
const https = require('https')
const JSZip = require('jszip')

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── Constants ─────────────────────────────────────────────────────────────────
const JOB_TIMEOUT_MS   = 30 * 60 * 1000  // 30 minutes
const ZIP_CHUNK_SIZE   = 50              // Max photos per ZIP chunk
const RATE_LIMIT_DELAY = 3000
const RATE_LIMIT_RETRY = 15000

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { headers }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }))
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')) })
    req.end()
  })
}

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'POST', headers }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }))
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')) })
    req.write(body)
    req.end()
  })
}

// ── Claude API ────────────────────────────────────────────────────────────────
async function callClaude(imageBase64, prompt, maxTokens = 32) {
  const body = JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
        { type: 'text', text: prompt }
      ]
    }]
  })

  const res = await httpsPost('api.anthropic.com', '/v1/messages', {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    'Content-Length': Buffer.byteLength(body)
  }, body)

  if (res.status === 429) {
    console.warn('Rate limited — waiting 15s before retry')
    await new Promise(r => setTimeout(r, RATE_LIMIT_RETRY))
    return callClaude(imageBase64, prompt, maxTokens)
  }

  if (res.status !== 200) {
    console.warn('Claude error:', res.body.slice(0, 200))
    return null
  }
  const data = JSON.parse(res.body)
  return data.content?.find(b => b.type === 'text')?.text?.trim() || null
}

// ── Plate reading with descriptive errors ─────────────────────────────────────
function isValidUKPlate(reg) {
  if (!reg || reg === 'UNKNOWN') return false
  const formats = [
    /^[A-Z]{2}\d{2}[A-Z]{3}$/,
    /^[A-Z]\d{3}[A-Z]{3}$/,
    /^[A-Z]{3}\d{3}[A-Z]$/,
    /^[A-Z]{2}\d{2}[A-Z]{2}$/,
    /^[A-Z]{1,3}\d{1,4}$/,
    /^\d{1,4}[A-Z]{1,3}$/,
  ]
  return formats.some(f => f.test(reg))
}

async function readPlate(imageBase64) {
  const prompt1 = `You are an expert UK vehicle registration plate reader.

Find the registration plate in this bus/vehicle image.
- Front plates: white background
- Rear plates: yellow background
- Modern format (most common): AB12CDE e.g. LJ20BKA, YN16NZC
- Older formats: A123BCD or ABC123D

Look carefully at all edges and corners. Characters 0/O, 1/I, 8/B, 5/S can look similar.

Reply ONLY with one of:
REG:AB12CDE  — if you can read a plate
REG:OBSCURED — if there is a plate but it is blocked or blurry
REG:DARK     — if the image is too dark to read
REG:NOPLATE  — if there is no plate visible in the image
REG:UNKNOWN  — if you cannot determine why it is unreadable`

  const text1 = await callClaude(imageBase64, prompt1)
  if (text1) {
    const match = text1.match(/REG:([A-Z0-9]+)/i)
    if (match) {
      const reg = match[1].toUpperCase()
      if (isValidUKPlate(reg))  return { reg, error: null }
      if (reg === 'OBSCURED')   return { reg: null, error: 'Plate obscured or blurry' }
      if (reg === 'DARK')       return { reg: null, error: 'Image too dark to read plate' }
      if (reg === 'NOPLATE')    return { reg: null, error: 'No plate visible in image' }
      if (reg !== 'UNKNOWN')    console.log(`Invalid format: ${reg}, retrying...`)
    }
  }

  // Second attempt
  const text2 = await callClaude(imageBase64,
    `Find the number plate on this vehicle. Reply ONLY: REG:XXXXXXX or REG:UNKNOWN`)
  if (text2) {
    const match = text2.match(/REG:([A-Z0-9]{2,8})/i)
    if (match && match[1] !== 'UNKNOWN') {
      return { reg: match[1].toUpperCase(), error: null }
    }
  }

  return { reg: null, error: 'Plate not readable' }
}

// ── Company detection ─────────────────────────────────────────────────────────
async function identifyCompany(imageBase64) {
  const text = await callClaude(imageBase64,
    `What bus/coach company is shown? Reply ONLY: COMPANY:Name or COMPANY:Unknown`, 24)
  if (!text) return null
  const match = text.match(/COMPANY:([^,\n]+)/i)
  const company = match ? match[1].trim() : null
  return company && company.toLowerCase() !== 'unknown' ? company : null
}

// ── Reverse geocode ───────────────────────────────────────────────────────────
async function reverseGeocode(lat, lon) {
  try {
    const res = await httpsGet(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`,
      { 'User-Agent': 'BusBoard/1.0', 'Accept': 'application/json' }
    )
    if (!res.body.startsWith('{')) return null
    const a = JSON.parse(res.body).address || {}
    return [a.road || a.pedestrian, a.suburb || a.neighbourhood,
      a.city || a.town || a.village, a.county, a.country
    ].filter(Boolean).join(', ')
  } catch { return null }
}

// ── EXIF extraction ───────────────────────────────────────────────────────────
async function extractExif(buffer) {
  try {
    const exifr = await import('exifr')
    const data  = await exifr.default.parse(buffer, {
      pick: ['DateTimeOriginal', 'CreateDate', 'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef']
    })
    if (!data) return {}

    function toDecimal(val) {
      if (val == null) return null
      if (Array.isArray(val)) return val[0] + (val[1] / 60) + (val[2] / 3600)
      return parseFloat(val)
    }

    let lat = toDecimal(data.GPSLatitude)
    let lon = toDecimal(data.GPSLongitude)
    if (lat != null && data.GPSLatitudeRef  === 'S') lat = -lat
    if (lon != null && data.GPSLongitudeRef === 'W') lon = -lon

    const raw = data.DateTimeOriginal || data.CreateDate
    let dateStr = null, dateShort = null
    if (raw) {
      const d = raw instanceof Date ? raw : new Date(String(raw).replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'))
      dateStr   = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                + ' at ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      dateShort = d.toISOString().slice(0, 10)
    }
    return { lat, lon, dateStr, dateShort }
  } catch (e) {
    console.warn('EXIF failed:', e.message)
    return {}
  }
}

// ── Image conversion for Claude ───────────────────────────────────────────────
async function toJpegForClaude(buffer, ext) {
  const isHeic = ext === 'heic' || ext === 'heif'
  try {
    const sharp = require('sharp')
    let input = buffer
    if (isHeic) {
      try {
        const heicConvert = require('heic-convert')
        const jpeg = await heicConvert({ buffer, format: 'JPEG', quality: 0.85 })
        input = Buffer.from(jpeg)
      } catch {}
    }
    return await sharp(input)
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer()
  } catch (e) {
    console.warn('sharp failed:', e.message)
    return buffer
  }
}

// ── Filename builder ──────────────────────────────────────────────────────────
function buildFilename(format, { reg, dateShort, address, company }, ext) {
  const parts  = (format || 'reg').split('_')
  const pieces = []
  for (const part of parts) {
    if (part === 'reg' && reg) pieces.push(reg)
    if (part === 'date' && dateShort) pieces.push(dateShort)
    if (part === 'location' && address) {
      const segments = address.split(',').map(s => s.trim())
      const city = segments[2] || segments[1] || segments[0]
      if (city) {
        const loc = city.replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '-').slice(0, 20)
        if (loc) pieces.push(loc)
      }
    }
    if (part === 'company' && company) {
      const co = company.replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '-').slice(0, 15)
      if (co) pieces.push(co)
    }
  }
  if (!pieces.length && reg) pieces.push(reg)
  return `${pieces.join('_')}.${ext}`
}

// ── Email notification ────────────────────────────────────────────────────────
async function sendCompletionEmail(email, found, total, zipUrl) {
  if (!process.env.RESEND_API_KEY) return
  try {
    const body = JSON.stringify({
      from: 'BusBoard <noreply@busboard.app>',
      to: email,
      subject: `Your BusBoard batch is ready — ${found} plates found`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px">
          <h1 style="color:#C8102E;font-size:28px;margin-bottom:8px">🚌 BusBoard</h1>
          <h2 style="color:#1a1a1a;font-size:20px;margin-bottom:24px">Your batch is ready to download</h2>
          <p style="color:#555;font-size:16px">We processed <strong>${total} photos</strong> and successfully identified <strong>${found} registration plates</strong>.</p>
          <div style="margin:32px 0">
            <a href="${zipUrl}" style="background:#C8102E;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">
              💾 Download ZIP
            </a>
          </div>
          <p style="color:#999;font-size:13px">This link expires in 24 hours. Unrecognised photos are included in the unprocessed folder inside the ZIP.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:32px 0">
          <p style="color:#bbb;font-size:12px">BusBoard — Automatic registration plate reader for bus enthusiasts</p>
        </div>
      `
    })

    await httpsPost('api.resend.com', '/emails', {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Length': Buffer.byteLength(body)
    }, body)

    console.log(`Email sent to ${email}`)
  } catch (e) {
    console.warn('Email failed:', e.message)
  }
}

// ── Process a single photo ────────────────────────────────────────────────────
async function processPhoto(job) {
  const { photoId, jobId, userId, storagePath, originalName } = job.data
  console.log(`Processing: ${originalName}`)

  // Crash recovery — skip if already done
  const { data: existing } = await supabase
    .from('photos').select('status').eq('id', photoId).single()
  if (existing?.status === 'done') {
    console.log(`Skipping ${originalName} — already processed`)
    return
  }

  const { data: profile } = await supabase
    .from('profiles').select('filename_format').eq('id', userId).single()
  const format       = profile?.filename_format || 'reg'
  const needsCompany = format.includes('company')

  const { data: fileData, error: dlError } = await supabase.storage
    .from('photos').download(storagePath)
  if (dlError) throw new Error(`Download failed: ${dlError.message}`)

  const buffer  = Buffer.from(await fileData.arrayBuffer())
  const ext     = originalName.split('.').pop().toLowerCase()
  const saveExt = (ext === 'heic' || ext === 'heif') ? 'jpg' : ext

  const { lat, lon, dateStr, dateShort } = await extractExif(buffer)
  const claudeBuf = await toJpegForClaude(buffer, ext)
  const b64       = claudeBuf.toString('base64')

  const { reg, error: plateError } = await readPlate(b64)
  console.log(`Plate: ${reg || plateError}`)

  let company = null
  if (needsCompany && reg) {
    company = await identifyCompany(b64)
    console.log(`Company: ${company}`)
  }

  let address = null
  if (lat != null && lon != null) address = await reverseGeocode(lat, lon)

  const newName = reg ? buildFilename(format, { reg, dateShort, address, company }, saveExt) : null
  console.log(`New name: ${newName}`)

  await supabase.from('photos').update({
    reg:      reg || null,
    new_name: newName,
    date_str: dateStr,
    address, company, lat, lon,
    status:   reg ? 'done' : 'failed',
    error:    reg ? null : (plateError || 'Plate not readable'),
  }).eq('id', photoId)

  await supabase.rpc('increment_job_processed', { job_id: jobId })
  await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY))
  return { reg, newName }
}

// ── Build and upload ZIP chunks ───────────────────────────────────────────────
async function buildAndUploadZip(photos, userId, jobId, label, folderName) {
  const chunks  = []
  for (let i = 0; i < photos.length; i += ZIP_CHUNK_SIZE) {
    chunks.push(photos.slice(i, i + ZIP_CHUNK_SIZE))
  }

  const zipUrls = []

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk  = chunks[ci]
    const zip    = new JSZip()
    const folder = zip.folder(folderName)

    for (const photo of chunk) {
      try {
        const { data: fileData, error } = await supabase.storage
          .from('photos').download(photo.storage_path)
        if (error) continue

        const buf = Buffer.from(await fileData.arrayBuffer())

        if (folderName === 'renamed') {
          let zipName = photo.new_name
          let counter = 1
          while (folder.files[`${folderName}/${zipName}`]) {
            const parts = photo.new_name.split('.')
            const ext   = parts.pop()
            zipName = `${parts.join('.')}_${counter++}.${ext}`
          }
          folder.file(zipName, buf)
          console.log(`ZIP renamed: ${zipName}`)
        } else {
          const name = photo.original_name || `photo_${photo.id}.jpg`
          folder.file(name, buf)
          console.log(`ZIP unprocessed: ${name}`)
        }
      } catch (e) {
        console.warn('ZIP error:', e.message)
      }
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 }
    })
    const suffix  = chunks.length > 1 ? `_part${ci + 1}of${chunks.length}` : ''
    const zipFile = `${label}${suffix}.zip`
    const zipPath = `${userId}/${jobId}/${zipFile}`

    console.log(`Uploading: ${zipFile} (${Math.round(zipBuffer.length / 1024 / 1024)}MB)`)

    const { error: uploadError } = await supabase.storage.from('photos').upload(zipPath, zipBuffer, {
      contentType: 'application/zip', upsert: true
    })
    if (uploadError) { console.error('Upload failed:', uploadError.message); continue }

    const { data: signed } = await supabase.storage.from('photos')
      .createSignedUrl(zipPath, 60 * 60 * 24 * 7)
    if (signed?.signedUrl) zipUrls.push(signed.signedUrl)
  }

  return zipUrls
}

// ── Finish job ────────────────────────────────────────────────────────────────
async function finishJob(job) {
  const { jobId, userId } = job.data
  console.log(`Finishing job: ${jobId}`)

  await new Promise(r => setTimeout(r, 3000))

  const { data: photos } = await supabase
    .from('photos').select('*').eq('job_id', jobId)

  const done   = photos.filter(p => p.status === 'done')
  const failed = photos.filter(p => p.status === 'failed')
  const found  = done.length

  const { data: userProfile } = await supabase
    .from('profiles').select('email').eq('id', userId).single()
  const userName  = (userProfile?.email || 'user').split('@')[0]
    .replace(/[^a-zA-Z0-9]/g, '-').slice(0, 20)
  const dateStamp = new Date().toISOString().slice(0, 10)
  const label     = `BusBoard_${userName}_${dateStamp}`

  console.log(`Building ZIP: ${done.length} renamed, ${failed.length} unprocessed`)

  const renamedUrls     = done.length   > 0 ? await buildAndUploadZip(done,   userId, jobId, `${label}_renamed`,     'renamed')     : []
  const unprocessedUrls = failed.length > 0 ? await buildAndUploadZip(failed, userId, jobId, `${label}_unprocessed`, 'unprocessed') : []

  const zipUrl = renamedUrls[0] || unprocessedUrls[0] || null

  await supabase.from('jobs').update({
    status:       'complete',
    found,
    processed:    photos.length,
    zip_url:      zipUrl,
    completed_at: new Date().toISOString(),
    expires_at:   new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }).eq('id', jobId)

  console.log(`Job ${jobId} complete: ${found}/${photos.length} plates found`)

  if (userProfile?.email && zipUrl) {
    await sendCompletionEmail(userProfile.email, found, photos.length, zipUrl)
  }
}

// ── Timeout checker ───────────────────────────────────────────────────────────
async function checkTimedOutJobs() {
  try {
    const cutoff = new Date(Date.now() - JOB_TIMEOUT_MS).toISOString()
    const { data: stuckJobs } = await supabase
      .from('jobs').select('id').eq('status', 'processing').lt('created_at', cutoff)

    if (!stuckJobs?.length) return
    console.log(`Timing out ${stuckJobs.length} stuck job(s)`)
    for (const j of stuckJobs) {
      await supabase.from('jobs').update({ status: 'failed' }).eq('id', j.id)
    }
  } catch (e) {
    console.error('Timeout check error:', e.message)
  }
}

// ── Cleanup expired jobs ──────────────────────────────────────────────────────
async function runCleanup() {
  try {
    const { data: expiredJobs } = await supabase
      .from('jobs').select('id, user_id')
      .lt('expires_at', new Date().toISOString())
      .neq('status', 'expired')

    if (!expiredJobs?.length) return
    console.log(`Cleaning ${expiredJobs.length} expired job(s)`)

    for (const job of expiredJobs) {
      const { data: photos } = await supabase
        .from('photos').select('storage_path').eq('job_id', job.id)
      const paths = (photos || []).map(p => p.storage_path).filter(Boolean)
      if (paths.length) await supabase.storage.from('photos').remove(paths)

      const { data: zipFiles } = await supabase.storage.from('photos')
        .list(`${job.user_id}/${job.id}`)
      if (zipFiles?.length) {
        await supabase.storage.from('photos').remove(
          zipFiles.map(f => `${job.user_id}/${job.id}/${f.name}`)
        )
      }

      await supabase.from('jobs').update({ status: 'expired', zip_url: null }).eq('id', job.id)
      console.log(`Expired job ${job.id}`)
    }
  } catch (e) {
    console.error('Cleanup error:', e.message)
  }
}

// ── Crash recovery on startup ─────────────────────────────────────────────────
async function recoverInterruptedJobs() {
  try {
    const { data: stuck } = await supabase
      .from('photos').select('id').eq('status', 'processing')
    if (!stuck?.length) return
    console.log(`Crash recovery: resetting ${stuck.length} stuck photo(s)`)
    for (const p of stuck) {
      await supabase.from('photos').update({ status: 'pending' }).eq('id', p.id)
    }
  } catch (e) {
    console.error('Crash recovery error:', e.message)
  }
}

// ── Worker ────────────────────────────────────────────────────────────────────
const worker = new Worker('photo-processing', async (job) => {
  console.log(`Job received: ${job.name}`)
  if (job.name === 'process-photo') return processPhoto(job)
  if (job.name === 'finish-job')    return finishJob(job)
}, {
  connection,
  concurrency: 1,
})

worker.on('completed', job => console.log(`✓ ${job.name} ${job.id}`))
worker.on('failed',    (job, err) => console.error(`✗ ${job?.name}: ${err.message}`))

console.log('🚌 BusBoard worker started — waiting for jobs…')

recoverInterruptedJobs()
runCleanup()
checkTimedOutJobs()
setInterval(() => { runCleanup(); checkTimedOutJobs() }, 60 * 60 * 1000)

process.on('SIGTERM', async () => {
  await worker.close()
  process.exit(0)
})
