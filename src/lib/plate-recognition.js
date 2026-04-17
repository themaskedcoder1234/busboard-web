import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: {
    'anthropic-beta': 'prompt-caching-2024-07-31',
  },
})

// UK plate regex — current (AB12 CDE), prefix (A123 BCD), suffix (ABC 123D)
const UK_PLATE_REGEX = /^[A-Z]{2}[0-9]{2}\s?[A-Z]{3}$|^[A-Z][0-9]{1,3}\s?[A-Z]{3}$|^[A-Z]{3}\s?[0-9]{1,3}[A-Z]$/i

const SYSTEM_PROMPT = `You are a UK vehicle number plate recognition specialist for BusBoard,
a photo management app for bus and coach enthusiasts.

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

export async function recognisePlate(imageBase64, mediaType, tier) {
  const haikuResult = await callModel('claude-haiku-4-5-20251001', imageBase64, mediaType)

  const shouldEscalate =
    (tier === 'pro' || tier === 'fleet') &&
    (haikuResult.confidence === 'low' ||
      haikuResult.confidence === 'medium' ||
      haikuResult.plate === null ||
      !isValidUKPlate(haikuResult.plate))

  if (!shouldEscalate) {
    return { ...haikuResult, model: 'haiku', escalated: false }
  }

  console.log(`[plate-recognition] Escalating to Sonnet — Haiku confidence: ${haikuResult.confidence}`)
  const sonnetResult = await callModel('claude-sonnet-4-6', imageBase64, mediaType)
  return { ...sonnetResult, model: 'sonnet', escalated: true }
}

async function callModel(model, imageBase64, mediaType) {
  const response = await anthropic.messages.create({
    model,
    max_tokens: 150,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageBase64 },
          },
          { type: 'text', text: 'Extract the bus or coach registration plate from this image.' },
        ],
      },
    ],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
  try {
    const parsed = JSON.parse(text.trim())
    return {
      plate: parsed.plate ?? null,
      confidence: parsed.confidence ?? 'low',
      reason: parsed.reason,
    }
  } catch {
    return { plate: null, confidence: 'low', reason: 'Failed to parse model response' }
  }
}

function isValidUKPlate(plate) {
  if (!plate) return false
  return UK_PLATE_REGEX.test(plate.trim())
}
