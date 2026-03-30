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
    const { searchParams } = new URL(req.url)
    const oauthToken    = searchParams.get('oauth_token')
    const verifier      = searchParams.get('oauth_verifier')
    const userId        = searchParams.get('uid')

    if (!oauthToken || !verifier || !userId) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?flickr=error`)
    }

    const supabase = createAdminClient()

    // Get stored request token secret
    const { data: profile } = await supabase
      .from('profiles')
      .select('flickr_token_secret')
      .eq('id', userId)
      .single()

    const tokenSecret = profile?.flickr_token_secret || ''
    const key         = process.env.FLICKR_CONSUMER_KEY
    const secret      = process.env.FLICKR_CONSUMER_SECRET
    const nonce       = crypto.randomBytes(16).toString('hex')
    const timestamp   = Math.floor(Date.now() / 1000).toString()

    const params = {
      oauth_consumer_key:     key,
      oauth_nonce:            nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp:        timestamp,
      oauth_token:            oauthToken,
      oauth_verifier:         verifier,
      oauth_version:          '1.0',
    }

    const sorted     = Object.keys(params).sort().map(k => `${percentEncode(k)}=${percentEncode(params[k])}`).join('&')
    const baseString = `GET&${percentEncode('https://www.flickr.com/services/oauth/access_token')}&${percentEncode(sorted)}`
    params.oauth_signature = sign(baseString, `${percentEncode(secret)}&${percentEncode(tokenSecret)}`)

    const qs  = Object.keys(params).sort().map(k => `${k}=${percentEncode(params[k])}`).join('&')
    const res = await fetch(`https://www.flickr.com/services/oauth/access_token?${qs}`)
    const parsed = Object.fromEntries(new URLSearchParams(await res.text()))

    if (!parsed.oauth_token) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?flickr=error`)
    }

    // Save access token to profile
    await supabase.from('profiles').update({
      flickr_token:        parsed.oauth_token,
      flickr_token_secret: parsed.oauth_token_secret,
      flickr_user_id:      parsed.user_nsid,
      flickr_username:     parsed.username,
    }).eq('id', userId)

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?flickr=connected`)
  } catch (e) {
    console.error('Flickr callback error:', e)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?flickr=error`)
  }
}
