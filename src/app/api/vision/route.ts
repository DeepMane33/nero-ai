import { NextRequest } from 'next/server';
import { setCustomApiKey } from '@/core/models';

export async function POST(request: NextRequest) {
  try {
    const clientApiKey = request.headers.get('x-api-key') || undefined;
    if (clientApiKey) setCustomApiKey('gemini', clientApiKey);

    const apiKey = process.env.GEMINI_API_KEY || clientApiKey;
    if (!apiKey) {
      return Response.json({ error: 'No API key configured. Go to Settings and add your Gemini API key.' }, { status: 500 });
    }

    let imageBase64: string;
    let mimeType = 'image/png';

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('image') as File | null;

      if (!file) {
        return Response.json({ error: 'No image file provided' }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      imageBase64 = buffer.toString('base64');
      mimeType = file.type || 'image/png';
    } else {
      const body = await request.json();
      const imageUrl = body.imageUrl;

      if (!imageUrl) {
        return Response.json({ error: 'imageUrl or image file is required' }, { status: 400 });
      }

      if (imageUrl.startsWith('data:')) {
        const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          imageBase64 = match[2];
        } else {
          return Response.json({ error: 'Invalid data URL format' }, { status: 400 });
        }
      } else {
        // Validate URL to prevent SSRF — block private/internal IPs
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(imageUrl);
        } catch {
          return Response.json({ error: 'Invalid URL format' }, { status: 400 });
        }
        if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
          return Response.json({ error: 'Only http/https URLs are allowed' }, { status: 400 });
        }
        const hostname = parsedUrl.hostname;
        const isPrivate = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.)/.test(hostname) ||
          hostname === '::1' || hostname === '[::1]';
        if (isPrivate) {
          return Response.json({ error: 'Private/internal URLs are not allowed' }, { status: 403 });
        }

        const imgResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
        if (!imgResponse.ok) {
          return Response.json({ error: 'Failed to fetch image' }, { status: 400 });
        }
        const bytes = await imgResponse.arrayBuffer();
        const buffer = Buffer.from(bytes);
        imageBase64 = buffer.toString('base64');
        mimeType = imgResponse.headers.get('content-type') || 'image/png';
      }
    }

    // Build URL with auth
    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
    const url = new URL(baseUrl);
    const isOAuth = apiKey.startsWith('AQ.')
    const visionHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
    if (isOAuth) {
      visionHeaders['Authorization'] = `Bearer ${apiKey}`
    } else {
      url.searchParams.set('key', apiKey);
    }

    const geminiResponse = await fetch(url.toString(), {
      method: 'POST',
      headers: visionHeaders,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: imageBase64,
                },
              },
              {
                text: 'Analyze this image in detail. Describe what you see, extract any text (OCR), explain diagrams, identify UI elements, and provide a comprehensive analysis.',
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text().catch(() => 'Unknown error');
      console.error('Gemini Vision API error:', errorText);
      return Response.json({ error: 'Failed to analyze image' }, { status: 502 });
    }

    const data = await geminiResponse.json();
    const description = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No description generated';

    return Response.json({
      description,
      details: {
        model: 'gemini-2.5-flash',
        tokens: data?.usageMetadata || null,
      },
    });
  } catch (error) {
    console.error('Error analyzing image:', error);
    return Response.json({ error: 'Failed to analyze image' }, { status: 500 });
  }
}
