const { Worker } = require('bullmq')
const { createClient } = require('@supabase/supabase-js')
const IORedis = require('ioredis')
const https = require('https')

const { default: Anthropic } = require('@anthropic-ai/sdk')
const { Resend } = require('resend')

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const resend = new Resend(process.env.RESEND_API_KEY)

const TIER_LIMITS = { free: 50, basic: 500, pro: 5000, fleet: 99999 }

const SYSTEM_PROMPT = `You are a UK vehicle number plate recognition specialist for BusBoard, a photo management app for bus and coach enthusiasts.

Your job is to extract the registration number from photos of buses and coaches.

Always respond with valid JSON only. No markdown, no explanation, just JSON.

Response format:
{
  "plate": "AB12 CDE",
  "confidence": "high" | "medium" | "low",
  "reason": "brief note if confidence is not high"
}

Rules:
- Return the plate in standard UK format with a space in the middle
- If no plate is visible, return { "plate": null, "confidence": "low", "reason": "no plate visible" }
- confidence "high" = clear, unambiguous read
- confidence "medium" = readable but partially obscured or at an angle
- confidence "low" = guessed, blurry, or very partial`

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchImageFromStorage(imageRef) {
  const { data, error } = await supabase.storage
    .from('photos')
    .download(imageRef)

  if (error || !data) throw new Error(`Storage fetch failed: ${imageRef}`)

  const buffer = await data.arrayBuffer()
  return Buffer.from(buffer).toString('base64')
}

// ── Token deduction (inline for CJS worker context) ───────────────────────────
async function deductTokens(userId, count) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier, tokens_used, tokens_reset_at')
    .eq('id', userId)
    .single()

  if (!profile) return false

  const tier = profile.subscription_tier ?? 'free'
  const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.free
  const resetAt = new Date(profile.tokens_reset_at)
  const now = new Date()

  let used = profile.tokens_used ?? 0
  if (now >= resetAt) used = 0

  const { error } = await supabase
    .from('profiles')
    .update({ tokens_used: Math.min(used + count, limit) })
    .eq('id', userId)

  return !error
}

// ── Batch worker — processes 200+ photo jobs via Anthropic Batch API ──────────
const batchWorker = new Worker(
  'batch-processing',
  async (job) => {
    const { userId, jobId, tier, imageRefs, fileNames, notifyEmail } = job.data
    console.log(`[batch-worker] Starting batch of ${imageRefs.length} for user ${userId}`)

    // Build batch requests
    const requests = []
    for (let i = 0; i < imageRefs.length; i++) {
      let imageBase64
      try {
        imageBase64 = await fetchImageFromStorage(imageRefs[i])
      } catch (e) {
        console.warn(`[batch-worker] Skipping ${fileNames[i]}: ${e.message}`)
        continue
      }

      // Pro/Fleet get Sonnet quality in batch; Free/Basic get Haiku
      const model = (tier === 'pro' || tier === 'fleet')
        ? 'claude-sonnet-4-6'
        : 'claude-haiku-4-5-20251001'

      requests.push({
        custom_id: `${i}`,
        params: {
          model,
          max_tokens: 150,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
                },
                { type: 'text', text: 'Extract the bus registration plate from this image.' },
              ],
            },
          ],
        },
      })
    }

    if (!requests.length) {
      console.warn('[batch-worker] No valid images to process')
      return { total: 0, successful: 0 }
    }

    // Submit batch to Anthropic
    const batch = await anthropic.messages.batches.create({ requests })
    console.log(`[batch-worker] Batch submitted: ${batch.id}`)

    // Poll until complete
    let batchResult = batch
    while (batchResult.processing_status === 'in_progress') {
      await sleep(30_000)
      batchResult = await anthropic.messages.batches.retrieve(batch.id)
      console.log(`[batch-worker] ${batch.id} status: ${batchResult.processing_status}`)
    }

    // Collect results and update photo records
    const results = []
    for await (const result of await anthropic.messages.batches.results(batch.id)) {
      const index = parseInt(result.custom_id, 10)
      const fileName = fileNames[index]
      const photoStoragePath = imageRefs[index]

      let plate = null
      let confidence = 'low'

      if (result.result.type === 'succeeded') {
        const text = result.result.message.content[0]?.type === 'text'
          ? result.result.message.content[0].text : ''
        try {
          const parsed = JSON.parse(text.trim())
          plate = parsed.plate ?? null
          confidence = parsed.confidence ?? 'low'
        } catch {}
      }

      // Update photo record in DB
      const reg = plate ? plate.replace(/\s/g, '') : null
      const { data: photoRow } = await supabase
        .from('photos')
        .select('id')
        .eq('job_id', jobId)
        .eq('storage_path', photoStoragePath)
        .single()

      if (photoRow) {
        await supabase.from('photos').update({
          reg:     reg || null,
          new_name: reg ? `${reg}.jpg` : null,
          status:  reg ? 'done' : 'failed',
          error:   reg ? null : 'Plate not readable',
        }).eq('id', photoRow.id)
      }

      results.push({ fileName, plate, confidence })
    }

    // Deduct tokens in bulk
    await deductTokens(userId, results.length)

    // Update job as complete
    const successful = results.filter(r => r.plate !== null).length
    await supabase.from('jobs').update({
      status:       'complete',
      found:        successful,
      processed:    results.length,
      completed_at: new Date().toISOString(),
      expires_at:   new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }).eq('id', jobId)

    // Email notification via Resend
    if (notifyEmail) {
      try {
        await resend.emails.send({
          from:    'BusBoard <onboarding@resend.dev>',
          to:      notifyEmail,
          subject: `Your ${results.length} photos are ready`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px">
              <h1 style="color:#C8102E;font-size:28px;margin-bottom:8px">BusBoard</h1>
              <h2 style="color:#1a1a1a;font-size:20px;margin-bottom:24px">Batch processing complete</h2>
              <p style="color:#555;font-size:16px">Your ${results.length} photos have been processed.</p>
              <ul style="color:#555;font-size:16px">
                <li>Plates identified: <strong>${successful}</strong></li>
                <li>Could not read: <strong>${results.length - successful}</strong></li>
              </ul>
              <div style="margin:32px 0">
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="background:#C8102E;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">
                  View your gallery &rarr;
                </a>
              </div>
              <hr style="border:none;border-top:1px solid #eee;margin:32px 0">
              <p style="color:#bbb;font-size:12px">BusBoard — Automatic registration plate reader for bus enthusiasts</p>
            </div>
          `,
        })
        console.log(`[batch-worker] Email sent to ${notifyEmail}`)
      } catch (e) {
        console.warn('[batch-worker] Email failed:', e.message)
      }
    }

    console.log(`[batch-worker] Batch ${batch.id} complete. ${successful}/${results.length} plates found.`)
    return { batchId: batch.id, total: results.length, successful }
  },
  {
    connection,
    concurrency: 2,
  }
)

batchWorker.on('completed', job => console.log(`[batch-worker] ✓ job ${job.id}`))
batchWorker.on('failed',    (job, err) => console.error(`[batch-worker] ✗ ${job?.id}: ${err.message}`))

console.log('🚌 BusBoard batch worker started — waiting for large jobs…')

process.on('SIGTERM', async () => {
  await batchWorker.close()
  process.exit(0)
})
