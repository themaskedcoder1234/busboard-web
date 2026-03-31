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

// ── Call Claude API ───────────────────────────────────────────────────────────
async function callClaude(imageBase64, prompt, maxTokens = 64) {
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

  console.log('Claude status:', res.status)
  if (res.status !== 200) {
    console.warn('Claude error:', res.body.slice(0, 200))
    return null
  }
  const data = JSON.parse(res.body)
  return data.content?.find(b => b.type === 'text')?.text?.trim() || null
}

// ── Validate UK plate format ──────────────────────────────────────────────────
function isValidUKPlate(reg) {
  if (!reg || reg === 'UNKNOWN') return false
  const formats = [
    /^[A-Z]{2}\d{2}[A-Z]{3}$/,   // AB12CDE  (2001–present, most common)
    /^[A-Z]\d{3}[A-Z]{3}$/,      // A123BCD  (1983–2001)
    /^[A-Z]{3}\d{3}[A-Z]$/,      // ABC123D  (1963–1983)
    /^[A-Z]{2}\d{2}[A-Z]{2}$/,   // AB12CD   (some cherished)
    /^[A-Z]{1,3}\d{1,4}$/,       // A1 to ABC1234 (prefix style)
    /^\d{1,4}[A-Z]{1,3}$/,       // 1A to 1234ABC (suffix style)
  ]
  return formats.some(f => f.test(reg))
}

// ── Read plate with improved prompting and retry ───────────────────────────────
async function readPlate(imageBase64) {
  // First attempt — detailed prompt
  const prompt1 = `You are an expert UK vehicle registration plate reader with years of experience reading bus and coach plates.

TASK: Find and read the vehicle registration plate in this image.

PLATE LOCATIONS on buses:
- Front: usually at bumper level, white background with black text
- Rear: usually above or below the back window/bumper, YELLOW background with black text
- Sometimes on the side near the front or rear

UK PLATE FORMATS (most common first):
- Modern (2001-present): Two letters, two numbers, three letters — e.g. LJ20BKA, YN16NZC, SN65OAA
- Prefix (1983-2001): One letter, up to three numbers, three letters — e.g. R123ABC
- Suffix (1963-1983): Three letters, up to three numbers, one letter — e.g. ABC123D

IMPORTANT TIPS:
- Look carefully at ALL edges and corners of the image
- The plate may be partially obscured or at an angle
- Characters sometimes look similar: 0/O, 1/I, 8/B, 5/S — use context to decide
- Read every character carefully left to right

Reply ONLY in this exact format: REG:AB12CDE
If you genuinely cannot find or read a plate: REG:UNKNOWN`

  const text1 = await callClaude(imageBase64, prompt1, 32)
  if (text1) {
    const match = text1.match(/REG:([A-Z0-9]{2,8})/i)
    if (match) {
      const reg = match[1].toUpperCase()
      if (isValidUKPlate(reg)) {
        console.log(`Plate found first attempt: ${reg}`)
        return reg
      }
      console.log(`First attempt returned invalid format: ${reg}, retrying...`)
    }
  }

  // Second attempt — different angle, simpler prompt focused on OCR
  await new Promise(r => setTimeout(r, 1000))

  const prompt2 = `Look very carefully at this bus/vehicle image. I need you to find the NUMBER PLATE.

The number plate will be a rectangular sign with letters and numbers on it.
- White plate = front of vehicle
- Yellow plate = rear of vehicle

Please scan the ENTIRE image including edges and corners.

What letters and numbers do you see on the number plate?
Reply ONLY with: REG:XXXXXXX (the exact characters, no spaces)
If there is definitely no readable plate: REG:UNKNOWN`

  const text2 = await callClaude(imageBase64, prompt2, 32)
  if (text2) {
    const match = text2.match(/REG:([A-Z0-9]{2,8})/i)
    if (match) {
      const reg = match[1].toUpperCase()
      console.log(`Plate found second attempt: ${reg}`)
      return reg
    }
  }

  console.log('No plate found after two attempts')
  return null
}

// ── Identify bus company ──────────────────────────────────────────────────────
async function identifyCompany(imageBase64) {
  const text = await callClaude(imageBase64, `Look at this bus or coach image and identify the operator/company name from the livery, logo or branding.
Reply ONLY with: COMPANY:Name (e.g. COMPANY:Stagecoach, COMPANY:Arriva, COMPANY:National Express)
If you cannot identify the company: COMPANY:Unknown`, 32)
  if (!text) return null
  const match = text.match(/COMPANY:([^,\n]+)/i)
  const company = match ? match[1].trim() : null
  return company && company.toLowerCase() !== 'unknown' ? company : null
}

// ── Reverse geocode ───────────────────────────────────────────────────────────
async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`
    const res = await httpsGet(url, {
      'User-Agent': 'BusBoard/1.0 (busboard-web)',
      'Accept': 'application/json'
    })
    if (!res.body.startsWith('{')) {
      console.warn('Geocode returned non-JSON')
      return null
    }
    const a = JSON.parse(res.body).address || {}
    return [
      a.road || a.pedestrian,
      a.suburb || a.neighbourhood,
      a.city || a.town || a.village,
      a.county,
      a.country
    ].filter(Boolean).join(', ')
  } catch (e) {
    console.warn('Geocode error:', e.message)
    return null
  }
}

// ── Extract EXIF ──────────────────────────────────────────────────────────────
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
    let dateStr = null
    let dateShort = null
    if (raw) {
      const d = raw instanceof Date ? raw : new Date(String(raw).replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'))
      dateStr   = d.toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      }) + ' at ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      // Short format for filename: YYYY-MM-DD
      dateShort = d.toISOString().slice(0, 10)
    }
    return { lat, lon, dateStr, dateShort }
  } catch (e) {
    console.warn('EXIF extraction failed:', e.message)
    return {}
  }
}

// ── Convert to JPEG ───────────────────────────────────────────────────────────
async function toJpegBase64(buffer, ext) {
  const isHeic = ext === 'heic' || ext === 'heif'
  if (isHeic) {
    try {
      const heicConvert = require('heic-convert')
      const jpeg = await heicConvert({ buffer, format: 'JPEG', quality: 0.85 })
      return Buffer.from(jpeg).toString('base64')
    } catch (e) {
      console.warn('heic-convert failed:', e.message)
    }
  }
  try {
    const sharp = require('sharp')
    const jpeg  = await sharp(buffer).jpeg({ quality: 85 }).toBuffer()
    return jpeg.toString('base64')
  } catch (e) {
    console.warn('sharp failed:', e.message)
    return buffer.toString('base64')
  }
}

// ── Build filename from format string ─────────────────────────────────────────
function buildFilename(format, { reg, dateShort, address, company }, ext) {
  const parts  = (format || 'reg').split('_')
  const pieces = []

  for (const part of parts) {
    if (part === 'reg'      && reg)       pieces.push(reg)
    if (part === 'date'     && dateShort) pieces.push(dateShort)
    if (part === 'location' && address) {
      // Take first two parts of address, sanitise for filename
      const loc = address.split(',').slice(0, 2).join('-')
        .replace(/[^a-zA-Z0-9\-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
      if (loc) pieces.push(loc)
    }
    if (part === 'company'  && company) {
      const co = company.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
      if (co) pieces.push(co)
    }
  }

  // Fallback to just reg if nothing built
  if (!pieces.length && reg) pieces.push(reg)
  return `${pieces.join('_')}.${ext}`
}

// ── Process a single photo ────────────────────────────────────────────────────
async function processPhoto(job) {
  const { photoId, jobId, userId, storagePath, originalName } = job.data
  console.log(`Processing: ${originalName}`)

  // Get user's filename format preference
  const { data: profile } = await supabase
    .from('profiles').select('filename_format').eq('id', userId).single()
  const format = profile?.filename_format || 'reg'
  const needsCompany  = format.includes('company')

  const { data: fileData, error: dlError } = await supabase.storage
    .from('photos').download(storagePath)
  if (dlError) throw new Error(`Storage download failed: ${dlError.message}`)

  const buffer = Buffer.from(await fileData.arrayBuffer())
  const ext    = originalName.split('.').pop().toLowerCase()
  const saveExt = (ext === 'heic' || ext === 'heif') ? 'jpg' : ext

  const { lat, lon, dateStr, dateShort } = await extractExif(buffer)
  const b64 = await toJpegBase64(buffer, ext)

  // Read plate (always needed)
  const reg = await readPlate(b64)
  console.log(`Plate: ${reg}`)

  // Identify company only if format needs it
  let company = null
  if (needsCompany && reg && reg !== 'UNKNOWN') {
    await new Promise(r => setTimeout(r, 1500)) // space out API calls
    company = await identifyCompany(b64)
    console.log(`Company: ${company}`)
  }

  // Reverse geocode
  let address = null
  if (lat != null && lon != null) {
    address = await reverseGeocode(lat, lon)
    console.log(`Address: ${address}`)
  }

  const newName = reg && reg !== 'UNKNOWN'
    ? buildFilename(format, { reg, dateShort, address, company }, saveExt)
    : null

  console.log(`New name: ${newName}`)

  await supabase.from('photos').update({
    reg:      reg && reg !== 'UNKNOWN' ? reg : null,
    new_name: newName,
    date_str: dateStr,
    address,
    company,
    lat, lon,
    status:   reg && reg !== 'UNKNOWN' ? 'done' : 'failed',
    error:    (!reg || reg === 'UNKNOWN') ? 'Plate not found' : null,
  }).eq('id', photoId)

  await supabase.rpc('increment_job_processed', { job_id: jobId })
  await new Promise(r => setTimeout(r, 1500))
  return { reg, newName }
}

// ── Helper: convert buffer to JPEG ───────────────────────────────────────────
async function bufferToJpeg(buf, storagePath) {
  const photoExt = storagePath.split('.').pop().toLowerCase()
  const isHeic   = photoExt === 'heic' || photoExt === 'heif'
  if (isHeic) {
    try {
      const heicConvert = require('heic-convert')
      const jpeg = await heicConvert({ buffer: buf, format: 'JPEG', quality: 0.85 })
      return Buffer.from(jpeg)
    } catch {
      try { const sharp = require('sharp'); return await sharp(buf).jpeg({ quality: 85 }).toBuffer() } catch {}
    }
  } else {
    try { const sharp = require('sharp'); return await sharp(buf).jpeg({ quality: 85 }).toBuffer() } catch {}
  }
  return buf
}

// ── Finish job — build ZIP with renamed/ and unprocessed/ folders ─────────────
async function finishJob(job) {
  const { jobId, userId } = job.data
  console.log(`Finishing job: ${jobId}`)

  await new Promise(r => setTimeout(r, 3000))

  const { data: photos } = await supabase
    .from('photos').select('*').eq('job_id', jobId)

  const done   = photos.filter(p => p.status === 'done')
  const failed = photos.filter(p => p.status === 'failed')
  const found  = done.length
  const zip    = new JSZip()

  // Create folders
  const renamedFolder     = zip.folder('renamed')
  const unprocessedFolder = zip.folder('unprocessed')

  console.log(`Building ZIP: ${done.length} renamed, ${failed.length} unprocessed`)

  // ── Add renamed photos ────────────────────────────────────────────────────
  for (const photo of done) {
    try {
      const { data: fileData, error: dlErr } = await supabase.storage
        .from('photos').download(photo.storage_path)
      if (dlErr) { console.warn(`ZIP skip ${photo.new_name}:`, dlErr.message); continue }

      const buf      = Buffer.from(await fileData.arrayBuffer())
      const finalBuf = await bufferToJpeg(buf, photo.storage_path)

      // Handle duplicate filenames within renamed folder
      let zipName = photo.new_name
      let counter = 1
      while (renamedFolder.files[`renamed/${zipName}`]) {
        const parts = photo.new_name.split('.')
        const ext   = parts.pop()
        zipName = `${parts.join('.')}_${counter}.${ext}`
        counter++
      }

      renamedFolder.file(zipName, finalBuf)
      console.log(`ZIP renamed: ${zipName}`)
    } catch (e) {
      console.warn('ZIP renamed error:', photo.new_name, e.message)
    }
  }

  // ── Add unprocessed photos ────────────────────────────────────────────────
  for (const photo of failed) {
    try {
      const { data: fileData, error: dlErr } = await supabase.storage
        .from('photos').download(photo.storage_path)
      if (dlErr) { console.warn(`ZIP skip unprocessed ${photo.original_name}:`, dlErr.message); continue }

      const buf      = Buffer.from(await fileData.arrayBuffer())
      const finalBuf = await bufferToJpeg(buf, photo.storage_path)

      // Use original filename for unprocessed
      const origName = photo.original_name || `unprocessed_${photo.id}.jpg`
      const ext      = photo.storage_path.split('.').pop().toLowerCase()
      const saveExt  = (ext === 'heic' || ext === 'heif') ? 'jpg' : ext
      const baseName = origName.replace(/\.[^.]+$/, '') + '.' + saveExt

      unprocessedFolder.file(baseName, finalBuf)
      console.log(`ZIP unprocessed: ${baseName}`)
    } catch (e) {
      console.warn('ZIP unprocessed error:', photo.original_name, e.message)
    }
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  console.log(`ZIP generated: ${zipBuffer.length} bytes (${done.length} renamed, ${failed.length} unprocessed)`)
  const zipPath = `${userId}/${jobId}/busboard-renamed.zip`

  await supabase.storage.from('photos').upload(zipPath, zipBuffer, {
    contentType: 'application/zip', upsert: true
  })

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

// ── Worker ────────────────────────────────────────────────────────────────────
const worker = new Worker('photo-processing', async (job) => {
  console.log(`Job received: ${job.name} (${job.id})`)
  if (job.name === 'process-photo') return processPhoto(job)
  if (job.name === 'finish-job')    return finishJob(job)
}, {
  connection,
  concurrency: 3,
})

worker.on('completed', job => console.log(`✓ ${job.name} ${job.id}`))
worker.on('failed',    (job, err) => console.error(`✗ ${job?.name} ${job?.id}: ${err.message}`))

console.log('🚌 BusBoard worker started — waiting for jobs…')

process.on('SIGTERM', async () => {
  await worker.close()
  process.exit(0)
})
