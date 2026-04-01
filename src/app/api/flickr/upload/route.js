import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import crypto from 'crypto'
import sharp from 'sharp'

function percentEncode(str) {
  return encodeURIComponent(String(str))
    .replace(/!/g,'%21').replace(/'/g,'%27')
    .replace(/\(/g,'%28').replace(/\)/g,'%29').replace(/\*/g,'%2A')
}

function sign(baseString, secret) {
  return crypto.createHmac('sha1', secret).update(baseString).digest('base64')
}

async function toJpeg(buffer) {
  try {
    const heicConvert = (await import('heic-convert')).default
    const jpeg = await heicConvert({ buffer, format: 'JPEG', quality: 0.9 })
    return Buffer.from(jpeg)
  } catch {}
  try {
    return await sharp(buffer)
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer()
  } catch (e) {
    console.warn('JPEG conversion failed:', e.message)
    return buffer
  }
}

async function flickrAPI(method, extraParams, key, secret, token, tokenSecret) {
  const nonce     = crypto.randomBytes(16).toString('hex')
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const params    = {
    ...extraParams,
    format: 'json', nojsoncallback: '1', method,
    oauth_consumer_key: key, oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp, oauth_token: token, oauth_version: '1.0',
  }
  const url    = 'https://api.flickr.com/services/rest/'
  const sorted = Object.keys(params).sort().map(k => `${percentEncode(k)}=${percentEncode(params[k])}`).join('&')
  params.oauth_signature = sign(`GET&${percentEncode(url)}&${percentEncode(sorted)}`, `${percentEncode(secret)}&${percentEncode(tokenSecret)}`)
  const qs  = Object.keys(params).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&')
  const res = await fetch(`${url}?${qs}`)
  return res.json()
}

async function uploadToFlickr(imgBuffer, fileName, title, description, tags, key, secret, token, tokenSecret, attempt = 1) {
  const url       = 'https://up.flickr.com/services/upload/'
  const nonce     = crypto.randomBytes(16).toString('hex')
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const params    = {
    title, description, tags,
    is_public: '0', is_friend: '0', is_family: '0', hidden: '2',
    oauth_consumer_key: key, oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp, oauth_token: token, oauth_version: '1.0',
  }
  const sorted       = Object.keys(params).sort().map(k => `${percentEncode(k)}=${percentEncode(params[k])}`).join('&')
  params.oauth_signature = sign(`POST&${percentEncode(url)}&${percentEncode(sorted)}`, `${percentEncode(secret)}&${percentEncode(tokenSecret)}`)
  const boundary     = `busboard_${crypto.randomBytes(8).toString('hex')}`
  const safeFileName = fileName.replace(/\.[^.]+$/, '') + '.jpg'
  const textPart     = Object.keys(params).map(k =>
    `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${params[k]}\r\n`
  ).join('')
  const body = Buffer.concat([
    Buffer.from(textPart),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${safeFileName}"\r\nContent-Type: image/jpeg\r\n\r\n`),
    imgBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ])
  const res   = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length },
    body
  })
  const xml   = await res.text()
  const match = xml.match(/<photoid>(\d+)<\/photoid>/)
  if (!match) {
    const isTemp = xml.includes('service is not currently available') || xml.includes('internal error')
    if (isTemp && attempt < 4) {
      console.warn(`Flickr temp error (attempt ${attempt}) — retrying in ${attempt * 5}s`)
      await new Promise(r => setTimeout(r, attempt * 5000))
      return uploadToFlickr(imgBuffer, fileName, title, description, tags, key, secret, token, tokenSecret, attempt + 1)
    }
    throw new Error(`Flickr upload failed: ${xml}`)
  }
  return match[1]
}

async function getOrCreateAlbum(title, primaryPhotoId, userId, key, secret, token, tokenSecret) {
  const sets     = await flickrAPI('flickr.photosets.getList', { user_id: userId }, key, secret, token, tokenSecret)
  const existing = sets.photosets?.photoset?.find(s => s.title._content === title)
  if (existing) {
    await flickrAPI('flickr.photosets.addPhoto',
      { photoset_id: existing.id, photo_id: primaryPhotoId }, key, secret, token, tokenSecret)
    return existing.id
  }
  const res = await flickrAPI('flickr.photosets.create', {
    title, description: `Bus photos — ${title}`, primary_photo_id: primaryPhotoId
  }, key, secret, token, tokenSecret)
  if (res.stat !== 'ok') throw new Error(res.message)
  return res.photoset.id
}

// Build album title based on user preference
function buildAlbumTitle(photo, format) {
  if (format === 'operator' && photo.company) return photo.company
  if (format === 'location' && photo.address) {
    return photo.address.split(',').map(s => s.trim())[2]
      || photo.address.split(',')[0]?.trim()
      || 'BusBoard'
  }
  return photo.date_str?.split(' at ')[0] || 'BusBoard'
}

// Build photo title based on user preference
function buildTitle(photo, format) {
  if (format === 'reg_operator' && photo.company) return `${photo.reg} — ${photo.company}`
  if (format === 'reg_date' && photo.date_str) {
    const short = photo.date_str.split(' at ')[0].split(', ').slice(1).join(', ')
    return `${photo.reg} — ${short}`
  }
  return photo.reg
}

// Build description based on user preference
function buildDescription(photo, format) {
  if (format === 'minimal') return `Registration: ${photo.reg}`
  const parts = [`Registration: ${photo.reg}`]
  if (format === 'basic') {
    if (photo.date_str) parts.push(`Photographed: ${photo.date_str}`)
    return parts.join('\n')
  }
  // full
  if (photo.date_str) parts.push(`Photographed: ${photo.date_str}`)
  if (photo.address)  parts.push(`Location: ${photo.address}`)
  if (photo.lat)      parts.push(`GPS: ${Number(photo.lat).toFixed(6)}°, ${Number(photo.lon).toFixed(6)}°`)
  if (photo.company)  parts.push(`Operator: ${photo.company}`)
  return parts.join('\n')
}

export async function POST(req) {
  try {
    const authToken = req.headers.get('authorization')?.replace('Bearer ', '')
    const supabase  = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser(authToken)
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { jobId, retryFailed } = await req.json()

    const { data: profile } = await supabase
      .from('profiles')
      .select('flickr_token, flickr_token_secret, flickr_user_id, flickr_album_format, flickr_title_format, flickr_description_format')
      .eq('id', user.id)
      .single()

    if (!profile?.flickr_token) return NextResponse.json({ error: 'Flickr not connected' }, { status: 400 })

    // Get photos — if retryFailed, only get ones without a flickr_id yet
    let query = supabase
      .from('photos')
      .select('*')
      .eq('job_id', jobId)
      .eq('user_id', user.id)
      .eq('status', 'done')
      .not('reg', 'is', null)

    if (retryFailed) {
      query = query.is('flickr_id', null)
    }

    const { data: photos } = await query

    console.log(`Flickr: uploading ${photos?.length || 0} photos (retryFailed=${retryFailed})`)

    const key    = process.env.FLICKR_CONSUMER_KEY
    const secret = process.env.FLICKR_CONSUMER_SECRET
    const { flickr_token: token, flickr_token_secret: tokenSecret, flickr_user_id: flickrUserId } = profile

    const albumFormat = profile.flickr_album_format  || 'date'
    const titleFormat = profile.flickr_title_format  || 'reg'
    const descFormat  = profile.flickr_description_format || 'full'

    const albumCache  = {}
    let uploaded      = 0
    let failed        = 0
    const total       = photos?.length || 0

    for (const photo of photos || []) {
      try {
        console.log(`Flickr: uploading ${photo.reg} (${uploaded + 1}/${total})`)

        const { data: fileData, error: dlErr } = await supabase.storage
          .from('photos').download(photo.storage_path)
        if (dlErr) { console.error('Download failed:', dlErr.message); failed++; continue }

        let buffer = Buffer.from(await fileData.arrayBuffer())
        buffer = await toJpeg(buffer)

        const title       = buildTitle(photo, titleFormat)
        const description = buildDescription(photo, descFormat)
        const tags        = [
          photo.reg, 'bus', 'transport', 'ukbus',
          photo.address?.split(',')[2]?.trim()?.toLowerCase(),
          photo.company?.toLowerCase()
        ].filter(Boolean).join(' ')

        const photoId = await uploadToFlickr(
          buffer, photo.new_name || `${photo.reg}.jpg`,
          title, description, tags,
          key, secret, token, tokenSecret
        )
        console.log(`Flickr: uploaded ${photo.reg} → ${photoId}`)

        const albumTitle = buildAlbumTitle(photo, albumFormat)
        if (!albumCache[albumTitle]) {
          albumCache[albumTitle] = await getOrCreateAlbum(
            albumTitle, photoId, flickrUserId, key, secret, token, tokenSecret
          )
        } else {
          await flickrAPI('flickr.photosets.addPhoto',
            { photoset_id: albumCache[albumTitle], photo_id: photoId },
            key, secret, token, tokenSecret
          )
        }

        await supabase.from('photos').update({ flickr_id: photoId }).eq('id', photo.id)
        uploaded++
      } catch (e) {
        console.error(`Flickr upload error for ${photo.reg}:`, e.message)
        failed++
      }
    }

    console.log(`Flickr: done — ${uploaded} uploaded, ${failed} failed`)
    return NextResponse.json({ uploaded, failed, total })
  } catch (e) {
    console.error('Flickr route error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
