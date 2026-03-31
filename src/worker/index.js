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

async function readPlate(imageBase64) {
  const body = JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 64,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
        { type: 'text', text: `You are a UK vehicle registration plate reader specialising in buses and coaches.
Find the registration plate in this image.
UK plates: front = white background, rear = yellow background.
Common formats: AB12CDE / A123BCD / ABC123D
Reply ONLY with: REG:AB12CDE (no spaces, uppercase)
If unreadable: REG:UNKNOWN` }
      ]
    }]
  })

  try {
    const res = await httpsPost('api.anthropic.com', '/v1/messages', {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Length': Buffer.byteLength(body)
    }, body)

    console.log('Claude status:', res.status, '| body:', res.body.slice(0, 400))
    const data  = JSON.parse(res.body)
    const text  = data.content?.find(b => b.type === 'text')?.text?.trim() || ''
    const match = text.match(/REG:([A-Z0-9]+)/i)
    return match ? match[1].toUpperCase() : null
  } catch (e) {
    console.error('Claude API error:', e.message)
    return null
  }
}

async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`
    const res = await httpsGet(url, {
      'User-Agent': 'BusBoard/1.0 (busboard-web)',
      'Accept': 'application/json'
    })
    if (!res.body.startsWith('{')) {
      console.warn('Geocode returned non-JSON:', res.body.slice(0, 100))
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

async function extractExif(buffer) {
  try {
    const exifr = await import('exifr')
    const data  = await exifr.default.parse(buffer, {
      pick: ['DateTimeOriginal', 'CreateDate', 'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef']
    })
    console.log('EXIF raw data:', JSON.stringify(data))
    if (!data) return {}

    const lat = data.GPSLatitude  != null ? parseFloat(data.GPSLatitude)  : null
    const lon = data.GPSLongitude != null ? parseFloat(data.GPSLongitude) : null
    const raw = data.DateTimeOriginal || data.CreateDate
    let dateStr = null
    if (raw) {
      const d = raw instanceof Date ? raw : new Date(String(raw).replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'))
      dateStr = d.toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      }) + ' at ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    }
    console.log('EXIF parsed — lat:', lat, 'lon:', lon, 'date:', dateStr)
    return { lat, lon, dateStr }
  } catch (e) {
    console.warn('EXIF extraction failed:', e.message)
    return {}
  }
}

async function toJpegBase64(buffer, ext) {
  const isHeic = ext === 'heic' || ext === 'heif'

  if (isHeic) {
    try {
      const heicConvert = require('heic-convert')
      const jpeg = await heicConvert({ buffer, format: 'JPEG', quality: 0.85 })
      console.log(`Converted HEIC to JPEG using heic-convert (${jpeg.length} bytes)`)
      return Buffer.from(jpeg).toString('base64')
    } catch (e) {
      console.warn('heic-convert failed:', e.message)
    }
  }

  try {
    const sharp = require('sharp')
    const jpeg  = await sharp(buffer).jpeg({ quality: 85 }).toBuffer()
    console.log(`Converted ${ext} to JPEG using sharp (${jpeg.length} bytes)`)
    return jpeg.toString('base64')
  } catch (e) {
    console.warn('sharp conversion failed:', e.message)
    return buffer.toString('base64')
  }
}

async function processPhoto(job) {
  const { photoId, jobId, storagePath, originalName } = job.data
  console.log(`Processing photo: ${originalName}`)

  const { data: fileData, error: dlError } = await supabase.storage
    .from('photos').download(storagePath)

  if (dlError) throw new Error(`Storage download failed: ${dlError.message}`)

  const buffer = Buffer.from(await fileData.arrayBuffer())
  const ext    = originalName.split('.').pop().toLowerCase()

  const { lat, lon, dateStr } = await extractExif(buffer)

  const b64 = await toJpegBase64(buffer, ext)
  const reg = await readPlate(b64)
  console.log(`Plate result for ${originalName}: ${reg}`)

  let address = null
  if (lat != null && lon != null) {
    console.log(`Geocoding: ${lat}, ${lon}`)
    address = await reverseGeocode(lat, lon)
    console.log(`Address: ${address}`)
  } else {
    console.log('No GPS data found in photo')
  }

  const isHeic  = ext === 'heic' || ext === 'heif'
  const saveExt = isHeic ? 'jpg' : ext
  const newName = reg && reg !== 'UNKNOWN' ? `${reg}.${saveExt}` : null

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

  await supabase.rpc('increment_job_processed', { job_id: jobId })
  return { reg, newName }
}

async function finishJob(job) {
  const { jobId, userId } = job.data
  console.log(`Finishing job: ${jobId}`)

  await new Promise(r => setTimeout(r, 3000))

  const { data: photos } = await supabase
    .from('photos').select('*').eq('job_id', jobId)

  const done  = photos.filter(p => p.status === 'done')
  const found = done.length
  const zip   = new JSZip()

  console.log(`Building ZIP with ${done.length} photos`)

  for (const photo of done) {
    try {
      console.log(`Adding to ZIP: ${photo.new_name} from ${photo.storage_path}`)
      const { data: fileData, error: dlErr } = await supabase.storage
        .from('photos').download(photo.storage_path)

      if (dlErr) {
        console.warn(`ZIP download failed for ${photo.new_name}:`, dlErr.message)
        continue
      }

      const buf      = Buffer.from(await fileData.arrayBuffer())
      const photoExt = photo.storage_path.split('.').pop().toLowerCase()
      const isHeic   = photoExt === 'heic' || photoExt === 'heif'
      let finalBuf   = buf

      if (isHeic) {
        try {
          const heicConvert = require('heic-convert')
          const jpeg = await heicConvert({ buffer: buf, format: 'JPEG', quality: 0.85 })
          finalBuf = Buffer.from(jpeg)
          console.log(`ZIP: converted HEIC to JPEG for ${photo.new_name}`)
        } catch (e) {
          console.warn(`ZIP: heic-convert failed for ${photo.new_name}:`, e.message)
        }
      } else {
        try {
          const sharp = require('sharp')
          finalBuf = await sharp(buf).jpeg({ quality: 85 }).toBuffer()
        } catch (e) {
          console.warn(`ZIP: sharp failed for ${photo.new_name}, using raw:`, e.message)
        }
      }
// Add a counter suffix if filename already exists in ZIP
let zipName = photo.new_name
let counter = 1
while (zip.files[zipName]) {
  const parts = photo.new_name.split('.')
  const ext   = parts.pop()
  zipName = `${parts.join('.')}_${counter}.${ext}`
  counter++
}
zip.file(zipName, finalBuf)
      console.log(`ZIP: added ${photo.new_name} (${finalBuf.length} bytes)`)
    } catch (e) {
      console.warn('ZIP: could not add', photo.new_name, e.message)
    }
  }

  console.log('Generating ZIP buffer...')
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  console.log(`ZIP generated: ${zipBuffer.length} bytes`)
  const zipPath = `${userId}/${jobId}/busboard-renamed.zip`

  await supabase.storage.from('photos').upload(zipPath, zipBuffer, {
    contentType: 'application/zip', upsert: true
  })

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

const worker = new Worker('photo-processing', async (job) => {
  console.log(`Job received: ${job.name} (${job.id})`)
  if (job.name === 'process-photo') return processPhoto(job)
  if (job.name === 'finish-job')    return finishJob(job)
}, {
  connection,
  concurrency: 5,
})

worker.on('completed', job => console.log(`✓ ${job.name} ${job.id}`))
worker.on('failed',    (job, err) => console.error(`✗ ${job?.name} ${job?.id}: ${err.message}`))

console.log('🚌 BusBoard worker started — waiting for jobs…')

process.on('SIGTERM', async () => {
  await worker.close()
  process.exit(0)
})
