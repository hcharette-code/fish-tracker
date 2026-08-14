import { extractReportFromImage } from './lib/extractReport'

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Server is missing ANTHROPIC_API_KEY (set it in Netlify env vars).' }),
      { status: 500 }
    )
  }

  let payload: { imageBase64?: string; mimeType?: string; todayIso?: string }
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
  }

  if (!payload.imageBase64 || !payload.mimeType) {
    return new Response(JSON.stringify({ error: 'imageBase64 and mimeType are required' }), { status: 400 })
  }

  try {
    const result = await extractReportFromImage({
      imageBase64: payload.imageBase64,
      mimeType: payload.mimeType,
      todayIso: payload.todayIso ?? new Date().toISOString().slice(0, 10),
      apiKey,
    })
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed'
    return new Response(JSON.stringify({ error: message }), { status: 502 })
  }
}
