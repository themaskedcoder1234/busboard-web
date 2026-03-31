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
    await new Promise(r => setTimeout(r, 15000))
    return callClaude(imageBase64, prompt, maxTokens)
  }

  if (res.status !== 200) {
    console.warn('Claude error:', res.body.slice(0, 200))
    return null
  }
  const data = JSON.parse(res.body)
  return data.content?.find(b => b.type === 'text')?.text?.trim() || null
}

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

Reply ONLY: REG:AB12CDE
If no plate visible: REG:UNKNOWN`

  const text1 = await callClaude(imageBase64, prompt1)
  if (text1) {
    const match = text1.match(/REG:([A-Z0-9]{2,8})/i)
    if (match) {
      const reg = match[1].toUpperCase()
      if (isValidUKPlate(reg)) {
        console.log(`Plate found: ${reg}`)
        return reg
      }
      if (reg !== 'UNKNOWN') console.log(`Invalid format: ${reg}, retrying...`)
    }
  }

  // Second attempt with simpler prompt
  const text2 = await callClaude(imageBase64,
    `Find the number plate on this vehicle. Reply ONLY: REG:XXXXXXX or REG:UNKNOWN`)
  if (text2) {
    const match = text2.match(/REG:([A-Z0-9]{2,8})/i)
    if (match && match[1] !== 'UNKNOWN') {
      console.log(`Plate found (attempt 2): ${match[1]}`)
      return match[1].toUpperCase()
    }
  }

  return null
}

async function identifyCompany(imageBase64) {
  const text = await callClaude(imageBase64,
    `What bus/coach company is shown? Reply ONLY: COMPANY:Name or COMPANY:Unknown`, 24)
  if (!text) return null
  const match = text.match(/COMPANY:([^,\n]+)/i)
  const company = match ? match[1].trim() : null
  return company && company.toLowerCase() !== 'unknown' ? company : null
}

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

async function extractExif(buffer) {
  try {
    const exifr = await import('exifr')
    const data  = await exifr.default.parse(buffer, {
      pick: ['DateTimeOriginal', 'CreateDate', 'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef']
    })
    if (!data) return {}
    const lat = data.GPSLatitude  != null ? parseFloat(data.GPSLatitude)  : null
    const lon = data.GPSLongitude != null ? parseFloat(data.GPSLongitude) : null
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

async function toJpegBuffer(buffer, ext) {
  const isHeic = ext === 'heic' || ext === 'heif'
  try {
    const sharp = require('sharp')
    let pipeline = sharp(isHeic ? buffer : buffer)

    if (isHeic) {
      try {
        const heicConvert = require('heic-convert')
        const jpeg = await heicConvert({ buffer, format: 'JPEG', quality: 0.85 })
        pipeline = sharp(Buffer.from(jpeg))
      } catch {}
    }

    // Resize to max 1600px on longest side — keeps detail but stays under 5MB
    return await pipeline
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer()
  } catch (e) {
    console.warn('sharp failed:', e.message)
    return buffer
  }
}

function buildFilename(format, { reg, dateShort, address, company }, ext) {
  const parts  = (format || 'reg').split('_')
  const pieces = []

  for (const part of parts) {
    if (part === 'reg' && reg) {
      pieces.push(reg)
    }
    if (part === 'date' && dateShort) {
      pieces.push(dateShort)
    }
    if (part === 'location' && address) {
      // Take city only (3rd segment) — keeps it short
      const segments = address.split(',').map(s => s.trim())
      const city = segments[2] || segments[1] || segments[0]
      if (city) {
        const loc = city
          .replace(/[^a-zA-Z0-9\s]/g, '')
          .trim()
          .replace(/\s+/g, '-')
          .slice(0, 20)  // Max 20 chars
        if (loc) pieces.push(loc)
      }
    }
    if (part === 'company' && company) {
      const co = company
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 15)  // Max 15 chars
      if (co) pieces.push(co)
    }
  }

  if (!pieces.length && reg) pieces.push(reg)
  return `${pieces.join('_')}.${ext}`
}

async function processPhoto(job) {
  const { photoId, jobId, userId, storagePath, originalName } = job.data
  console.log(`Processing: ${originalName}`)

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
  const jpegBuf = await toJpegBuffer(buffer, ext)
  const b64     = jpegBuf.toString('base64')

  const reg = await readPlate(b64)
  console.log(`Plate: ${reg}`)

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
    error:    reg ? null : 'Plate not found',
  }).eq('id', photoId)

  await supabase.rpc('increment_job_processed', { job_id: jobId })

  // Delay to stay within rate limits
  await new Promise(r => setTimeout(r, 3000))
  return { reg, newName }
}

async function finishJob(job) {
  const { jobId, userId } = job.data
  console.log(`Finishing job: ${jobId}`)

  await new Promise(r => setTimeout(r, 3000))

  const { data: photos } = await supabase
    .from('photos').select('*').eq('job_id', jobId)

  const done   = photos.filter(p => p.status === 'done')
  const failed = photos.filter(p => p.status === 'failed')
  const found  = done.length

  console.log(`Building ZIP: ${done.length} renamed, ${failed.length} unprocessed`)

  const zip            = new JSZip()
  const renamedFolder  = zip.folder('renamed')
  const unprocessedFolder = zip.folder('unprocessed')

  // Add renamed photos — process in small batches to avoid memory spikes
  for (const photo of done) {
    try {
      const { data: fileData, error } = await supabase.storage
        .from('photos').download(photo.storage_path)
      if (error) { console.warn('Skip renamed:', photo.new_name, error.message); continue }

      const buf      = Buffer.from(await fileData.arrayBuffer())
      const finalBuf = await toJpegBuffer(buf, photo.storage_path.split('.').pop().toLowerCase())

      let zipName = photo.new_name
      let counter = 1
      while (renamedFolder.files[`renamed/${zipName}`]) {
        const parts = photo.new_name.split('.')
        const ext   = parts.pop()
        zipName = `${parts.join('.')}_${counter++}.${ext}`
      }

      renamedFolder.file(zipName, finalBuf)
      console.log(`ZIP renamed: ${zipName} (${Math.round(finalBuf.length/1024)}KB)`)

      // Release buffer from memory
      finalBuf.fill(0)
    } catch (e) {
      console.warn('ZIP renamed error:', e.message)
    }
  }

  // Add unprocessed photos
  for (const photo of failed) {
    try {
      const { data: fileData, error } = await supabase.storage
        .from('photos').download(photo.storage_path)
      if (error) { console.warn('Skip unprocessed:', photo.original_name, error.message); continue }

      const buf      = Buffer.from(await fileData.arrayBuffer())
      const ext      = photo.storage_path.split('.').pop().toLowerCase()
      const finalBuf = await toJpegBuffer(buf, ext)
      const saveExt  = (ext === 'heic' || ext === 'heif') ? 'jpg' : ext
      const baseName = (photo.original_name || `photo_${photo.id}`).replace(/\.[^.]+$/, '') + '.' + saveExt

      unprocessedFolder.file(baseName, finalBuf)
      console.log(`ZIP unprocessed: ${baseName} (${Math.round(finalBuf.length/1024)}KB)`)

      finalBuf.fill(0)
    } catch (e) {
      console.warn('ZIP unprocessed error:', e.message)
    }
  }

  console.log('Generating ZIP...')
  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  })
  console.log(`ZIP: ${Math.round(zipBuffer.length / 1024 / 1024)}MB`)

  const zipPath = `${userId}/${jobId}/busboard-renamed.zip`
  const { error: uploadError } = await supabase.storage.from('photos').upload(zipPath, zipBuffer, {
    contentType: 'application/zip', upsert: true
  })

  if (uploadError) {
    console.error('ZIP upload failed:', uploadError.message)
    throw new Error(`ZIP upload failed: ${uploadError.message}`)
  }

  const { data: signedUrl } = await supabase.storage.from('photos')
    .createSignedUrl(zipPath, 60 * 60 * 24 * 7)

  await supabase.from('jobs').update({
    status: 'complete', found,
    processed: photos.length,
    zip_url: signedUrl?.signedUrl,
    completed_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }).eq('id', jobId)

  console.log(`Job ${jobId} complete: ${found}/${photos.length} plates found`)
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
      await supabase.storage.from('photos').remove([`${job.user_id}/${job.id}/busboard-renamed.zip`])
      await supabase.from('jobs').update({ status: 'expired', zip_url: null }).eq('id', job.id)
      console.log(`Expired job ${job.id}`)
    }
  } catch (e) {
    console.error('Cleanup error:', e.message)
  }
}

// ── Worker ────────────────────────────────────────────────────────────────────
const worker = new Worker('photo-processing', async (job) => {
  console.log(`Job received: ${job.name}`)
  if (job.name === 'process-photo') return processPhoto(job)
  if (job.name === 'finish-job')    return finishJob(job)
}, {
  connection,
  concurrency: 1,  // One at a time to stay within rate limits and memory
})

worker.on('completed', job => console.log(`✓ ${job.name} ${job.id}`))
worker.on('failed',    (job, err) => console.error(`✗ ${job?.name}: ${err.message}`))

console.log('🚌 BusBoard worker started — waiting for jobs…')

// Cleanup every hour
runCleanup()
setInterval(runCleanup, 60 * 60 * 1000)

process.on('SIGTERM', async () => {
  await worker.close()
  process.exit(0)
})
