export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const hfToken = process.env.HF_TOKEN;
    if (!hfToken) {
      return Response.json(
        {
          error: 'HF_TOKEN not configured',
          instructions:
            'Get a free Hugging Face token at https://huggingface.co/settings/tokens and add HF_TOKEN=hf_xxx to your .env.local file.',
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== 'string') {
      return Response.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const modelUrl =
      'https://api-inference.huggingface.co/models/ali-vilab/text-to-video-ms-1.7b';

    const response = await fetch(modelUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hfToken}`,
        'Content-Type': 'application/json',
        Accept: 'video/mp4',
      },
      body: JSON.stringify({
        inputs: prompt.trim(),
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      console.error('HF API error:', response.status, errText);

      // Model may be loading
      if (response.status === 503) {
        return Response.json(
          { error: 'Video model is loading. Please try again in 30-60 seconds.' },
          { status: 503 }
        );
      }

      return Response.json({ error: 'Video generation failed', detail: errText }, { status: 502 });
    }

    if (!response.body) {
      return Response.json({ error: 'No video data received' }, { status: 502 });
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': 'video/mp4',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err: any) {
    console.error('Video generation error:', err);
    return Response.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
