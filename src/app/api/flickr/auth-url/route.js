import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import crypto from 'crypto'

function percentEncode(str) {
  return encodeURIComponent(String(str))
    .replace(/!/g,'%21').replace(/'/g,'%27')
    .replace(/\(/g,'%28').replace(/\)/g,'%29').replace(/\*/g,'%2A')
}

function sign(baseString, secret) {
  return crypto.createHmac('sha1', secret).update(baseString).digest('base64')
}

export async function GET(req) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    const supabase = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const key    = process.env.FLICKR_CONSUMER_KEY
    const secret = process.env.FLICKR_CONSUMER_SECRET
    const callback = `${process.env.NEXT_PUBLIC_APP_URL}/api/flickr/callback?uid=${user.id}`

    const nonce     = crypto.randomBytes(16).toString('hex')
    const timestamp = Math.floor(Date.now() / 1000).toString()

    const params = {
      oauth_callback:         callback,
      oauth_consumer_key:     key,
      oauth_nonce:            nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp:        timestamp,
      oauth_version:          '1.0',
    }

    const sorted     = Object.keys(params).sort().map(k => `${percentEncode(k)}=${percentEncode(params[k])}`).join('&')
    const baseString = `GET&${percentEncode('https://www.flickr.com/services/oauth/request_token')}&${percentEncode(sorted)}`
    params.oauth_signature = sign(baseString, `${percentEncode(secret)}&`)

    const qs  = Object.keys(params).sort().map(k => `${k}=${percentEncode(params[k])}`).join('&')
    const res = await fetch(`https://www.flickr.com/services/oauth/request_token?${qs}`)
    const body = await res.text()
    const parsed = Object.fromEntries(new URLSearchParams(body))

    if (!parsed.oauth_token) throw new Error('Failed to get Flickr request token')

    // Store request token secret temporarily in profile
    await supabase.from('profiles').update({
      flickr_token_secret: parsed.oauth_token_secret
    }).eq('id', user.id)

    const authUrl = `https://www.flickr.com/services/oauth/authorize?oauth_token=${parsed.oauth_token}&perms=write`
    return NextResponse.json({ url: authUrl })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
