// ── BusBoard Background Worker ────────────────────────────────────────────────
// Run with: npm run worker
// Pulls jobs from Redis queue, processes each photo, updates Supabase

require('dotenv').config({ path: '.env.local' })

const { Worker } = require('bullmq')
const { createClient } = require('@supabase/supabase-js')
const IORedis = require('ioredis')
const https = require('https')
const crypto = require('crypto')
const JSZip = require('jszip')

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Read plate via Claude ─────────────────────────────────────────────────────
async function readPlate(imageBase64, mimeType) {
  const body = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 64,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
        { type: 'text', text: `You are a UK vehicle registration plate reader specialising in buses and coaches.
Find the registration plate in this image.
UK plates: front = white background, rear = yellow background.
Common formats: AB12CDE / A123BCD / ABC123D
Reply ONLY with: REG:AB12CDE (no spaces, uppercase)
If unreadable: REG:UNKNOWN` }
      ]
    }]
  })

  const res = await httpsPost('api.anthropic.com', '/v1/messages', {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    'Content-Length': Buffer.byteLength(body)
  }, body)

  const data  = JSON.parse(res.body)
  const text  = data.content?.find(b => b.type === 'text')?.text?.trim() || ''
  const match = text.match(/REG:([A-Z0-9]+)/i)
  return match ? match[1].toUpperCase() : null
}

// ── Reverse geocode ───────────────────────────────────────────────────────────
async function reverseGeocode(lat, lon) {
  try {
    const res = await httpsGet(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`,
      { 'User-Agent': 'BusBoard/1.0' }
    )
    const a = JSON.parse(res.body).address || {}
    return [
      a.road || a.pedestrian,
      a.suburb || a.neighbourhood,
      a.city || a.town || a.village,
      a.county,
      a.country
    ].filter(Boolean).join(', ')
  } catch { return null }
}

// ── Extract EXIF from buffer using exifr (pure JS, no exiftool needed) ────────
async function extractExif(buffer) {
  try {
    const exifr = await import('exifr')
    const data  = await exifr.default.parse(buffer, {
      pick: ['DateTimeOriginal', 'CreateDate', 'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef']
    })
    if (!data) return {}

    let lat = data.GPSLatitude  != null ? parseFloat(data.GPSLatitude)  : null
    let lon = data.GPSLongitude != null ? parseFloat(data.GPSLongitude) : null

    const raw = data.DateTimeOriginal || data.CreateDate
    let dateStr = null
    if (raw) {
      const d = raw instanceof Date ? raw : new Date(String(raw).replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'))
      dateStr = d.toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      }) + ' at ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    }

    return { lat, lon, dateStr }
  } catch (e) {
    console.warn('EXIF extraction failed:', e.message)
    return {}
  }
}

function formatReg(reg) {
  if (/^[A-Z]{2}\d{2}[A-Z]{3}$/.test(reg)) return `${reg.slice(0,4)} ${reg.slice(4)}`
  return reg
}

// ── Process a single photo ────────────────────────────────────────────────────
async function processPhoto(job) {
  const { photoId, jobId, userId, storagePath, originalName } = job.data

  // Download from Supabase storage
  const { data: fileData, error: dlError } = await supabase.storage
    .from('photos')
    .download(storagePath)

  if (dlError) throw new Error(`Storage download failed: ${dlError.message}`)

  const buffer   = Buffer.from(await fileData.arrayBuffer())
  const ext      = originalName.split('.').pop().toLowerCase()
  const mimeType = ext === 'heic' || ext === 'heif' ? 'image/jpeg' : `image/${ext === 'jpg' ? 'jpeg' : ext}`
  const b64      = buffer.toString('base64')

  // Read plate
  const reg = await readPlate(b64, mimeType)

  // Extract EXIF
  const { lat, lon, dateStr } = await extractExif(buffer)

  // Reverse geocode
  let address = null
  if (lat != null && lon != null) address = await reverseGeocode(lat, lon)

  const newName = reg && reg !== 'UNKNOWN'
    ? `${reg}.${ext === 'heic' || ext === 'heif' ? 'jpg' : ext}`
    : null

  // Update photo record
  await supabase.from('photos').update({
    reg:      reg && reg !== 'UNKNOWN' ? reg : null,
    new_name: newName,
    date_str: dateStr,
    address,
    lat,
    lon,
    status:   reg && reg !== 'UNKNOWN' ? 'done' : 'failed',
    error:    (!reg || reg === 'UNKNOWN') ? 'Plate not found' : null,
  }).eq('id', photoId)

  // Increment job processed count
  await supabase.rpc('increment_job_processed', { job_id: jobId })

  return { reg, newName }
}

// ── Finish job — build ZIP and update status ──────────────────────────────────
async function finishJob(job) {
  const { jobId, userId } = job.data

  // Wait a moment to ensure all photo jobs are truly done
  await new Promise(r => setTimeout(r, 3000))

  const { data: photos } = await supabase
    .from('photos')
    .select('*')
    .eq('job_id', jobId)

  const done    = photos.filter(p => p.status === 'done')
  const found   = done.length

  // Build ZIP
  const zip = new JSZip()

  for (const photo of done) {
    try {
      const { data: fileData } = await supabase.storage.from('photos').download(photo.storage_path)
      const buf = Buffer.from(await fileData.arrayBuffer())
      zip.file(photo.new_name, buf)
    } catch (e) {
      console.warn('ZIP: could not add', photo.new_name, e.message)
    }
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  const zipPath   = `${userId}/${jobId}/busboard-renamed.zip`

  await supabase.storage.from('photos').upload(zipPath, zipBuffer, {
    contentType: 'application/zip', upsert: true
  })

  // Get a signed URL (valid 7 days)
  const { data: signedUrl } = await supabase.storage.from('photos')
    .createSignedUrl(zipPath, 60 * 60 * 24 * 7)

  await supabase.from('jobs').update({
    status:       'complete',
    found,
    processed:    photos.length,
    zip_url:      signedUrl?.signedUrl,
    completed_at: new Date().toISOString()
  }).eq('id', jobId)

  console.log(`Job ${jobId} complete: ${found}/${photos.length} plates found`)
}

// ── Start worker ──────────────────────────────────────────────────────────────
const worker = new Worker('photo-processing', async (job) => {
  console.log(`Processing job: ${job.name} (${job.id})`)

  if (job.name === 'process-photo') return processPhoto(job)
  if (job.name === 'finish-job')    return finishJob(job)

}, {
  connection,
  concurrency: 5,   // Process 5 photos simultaneously
})

worker.on('completed', job => console.log(`✓ ${job.name} ${job.id}`))
worker.on('failed',    (job, err) => console.error(`✗ ${job?.name} ${job?.id}: ${err.message}`))

console.log('🚌 BusBoard worker started — waiting for jobs…')

// Graceful shutdown
process.on('SIGTERM', async () => {
  await worker.close()
  process.exit(0)
})
