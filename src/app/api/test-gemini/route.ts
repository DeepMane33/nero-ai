/**
 * POST /api/test-gemini — Diagnostic endpoint to test Gemini API key directly.
 * Used for debugging chat issues. Not exposed in production UI.
 */
export async function POST(request: Request) {
  try {
    const { apiKey, model = 'gemini-2.0-flash' } = await request.json()
    
    if (!apiKey) {
      return Response.json({ error: 'No API key provided' }, { status: 400 })
    }

    // Step 1: Test with a simple non-streaming request
    const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    
    const response = await fetch(testUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Say hello in one word.' }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 50
        }
      })
    })

    const status = response.status
    const responseText = await response.text()
    
    let parsed: any = null
    try { parsed = JSON.parse(responseText) } catch {}

    // Step 2: If basic test works, test streaming
    let streamTest: any = null
    if (status === 200) {
      try {
        const streamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`
        const streamResponse = await fetch(streamUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Say hello in one word.' }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 50
            }
          })
        })

        const streamStatus = streamResponse.status
        const streamText = await streamResponse.text()
        
        // Parse SSE chunks
        const chunks = streamText.split('\n').filter(l => l.startsWith('data: '))
        const parsedChunks = chunks.map(c => {
          try { return JSON.parse(c.slice(6)) } catch { return null }
        }).filter(Boolean)

        streamTest = {
          status: streamStatus,
          rawLength: streamText.length,
          chunkCount: chunks.length,
          firstChunk: parsedChunks[0] || null,
          candidates: parsedChunks[0]?.candidates || null,
          text: parsedChunks[0]?.candidates?.[0]?.content?.parts?.[0]?.text || null,
          finishReason: parsedChunks[0]?.candidates?.[0]?.finishReason || null,
          promptFeedback: parsedChunks[0]?.promptFeedback || null,
        }
      } catch (e: any) {
        streamTest = { error: e.message }
      }
    }

    return Response.json({
      model,
      nonStreaming: {
        status,
        text: parsed?.candidates?.[0]?.content?.parts?.[0]?.text || null,
        candidates: parsed?.candidates || null,
        promptFeedback: parsed?.promptFeedback || null,
        error: parsed?.error || null,
      },
      streaming: streamTest,
      rawResponseSnippet: responseText.slice(0, 500),
    })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
