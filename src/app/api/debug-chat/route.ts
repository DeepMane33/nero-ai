/**
 * POST /api/debug-chat — Minimal chat endpoint for debugging.
 * Bypasses all routing/memory/search/tools — pure Gemini API test.
 */
export async function POST(request: Request) {
  try {
    const { message, apiKey } = await request.json()
    
    if (!message) return Response.json({ error: 'No message' }, { status: 400 })
    if (!apiKey) return Response.json({ error: 'No API key provided' }, { status: 400 })

    // Simple non-streaming call first to test
    const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`
    const testResp = await fetch(testUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: message }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
      })
    })
    
    const testData = await testResp.json()
    
    if (!testResp.ok) {
      return Response.json({
        error: `Gemini API error: ${testResp.status}`,
        details: testData?.error,
        step: 'non-streaming-test'
      }, { status: 502 })
    }

    const text = testData?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      return Response.json({
        error: 'Gemini returned empty content',
        candidates: testData?.candidates,
        promptFeedback: testData?.promptFeedback,
        step: 'non-streaming-extract'
      }, { status: 502 })
    }

    // Now test streaming
    let streamText = ''
    let streamError = null
    try {
      const streamUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${apiKey}`
      const streamResp = await fetch(streamUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: message }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
        })
      })
      
      if (!streamResp.ok) {
        const errText = await streamResp.text().catch(() => 'unknown')
        streamError = `HTTP ${streamResp.status}: ${errText.slice(0, 200)}`
      } else {
        const reader = streamResp.body?.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        
        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''
            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed.startsWith('data: ')) continue
              try {
                const parsed = JSON.parse(trimmed.slice(6))
                const part = parsed?.candidates?.[0]?.content?.parts
                if (part) {
                  for (const p of part) {
                    if (p.text) streamText += p.text
                  }
                }
              } catch {}
            }
          }
        }
      }
    } catch (e: any) {
      streamError = e.message
    }

    return Response.json({
      success: true,
      nonStreaming: text,
      streaming: streamText || '(empty)',
      streamingError: streamError,
    })
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
