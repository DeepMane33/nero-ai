import { NextRequest } from 'next/server';
import { setCustomApiKey } from '@/core/models';

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/^>\s+/gm, '')
    .replace(/---+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Gemini TTS voices — natural, expressive
const GEMINI_VOICES: Record<string, string> = {
  // Female
  kore: 'Kore',       // Warm, expressive — default
  fenrir: 'Fenrir',   // Bright, energetic
  aoede: 'Aoede',     // Deep, resonant
  // Male
  puck: 'Puck',       // Upbeat, lively
  charon: 'Charon',   // Grounded, informative
  orion: 'Orion',     // Versatile, storytelling
  // Other
  zephyr: 'Zephyr',   // Gentle, calming
  ledbes: 'Ledbes',   // Authoritative
};

// Voice presets for quick selection
const VOICE_PRESETS: Record<string, { voice: string; style?: string }> = {
  default: { voice: 'Kore' },
  friendly: { voice: 'Puck' },
  professional: { voice: 'Charon' },
  calm: { voice: 'Zephyr' },
  energetic: { voice: 'Fenrir' },
  deep: { voice: 'Aoede' },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, voice = 'Kore', preset, speed, apiKey: clientApiKey, fallbackKey: clientFallbackKey } = body;

    // Temporarily store client key for this request
    if (clientApiKey && typeof clientApiKey === 'string') {
      setCustomApiKey('gemini', clientApiKey);
    }

    const apiKey = process.env.GEMINI_API_KEY || clientApiKey;
    if (!apiKey) {
      return Response.json({ error: 'No API key configured. Go to Settings and add your Gemini API key.' }, { status: 500 });
    }

    if (!text || typeof text !== 'string') {
      return Response.json({ error: 'Text is required' }, { status: 400 });
    }

    // Resolve voice from preset or direct name
    const resolvedVoice = VOICE_PRESETS[preset || '']?.voice || GEMINI_VOICES[voice] || voice || 'Kore';

    let cleanText = stripMarkdown(text).slice(0, 5000);
    if (!cleanText) {
      return Response.json({ error: 'No speakable text after stripping markdown' }, { status: 400 });
    }

    // Add natural sentence pauses for better prosody
    cleanText = cleanText
      .replace(/([.!?])\s+/g, '$1  ')
      .replace(/,\s*/g, ', ');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: cleanText }]
        }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: resolvedVoice,
              }
            }
          }
        }
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text().catch(() => 'Unknown error');
      console.error('[tts] Gemini TTS API error:', geminiResponse.status, errText);
      return Response.json({ error: `Gemini TTS failed: ${geminiResponse.status}` }, { status: 502 });
    }

    const data = await geminiResponse.json();
    const audioData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioData) {
      console.error('[tts] No audio data in Gemini response:', JSON.stringify(data).slice(0, 500));
      return Response.json({ error: 'No audio data returned' }, { status: 502 });
    }

    // Gemini returns base64-encoded PCM audio (24kHz, 16-bit, mono)
    const audioBuffer = Buffer.from(audioData, 'base64');

    // Convert raw PCM to WAV for browser compatibility
    const wavBuffer = pcmToWav(audioBuffer, 24000, 1, 16);

    return new Response(new Uint8Array(wavBuffer), {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': wavBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err: any) {
    console.error('[tts] Error:', err);
    return Response.json({ error: err.message || 'TTS generation failed' }, { status: 500 });
  }
}

/**
 * Convert raw PCM audio data to WAV format for browser playback.
 */
function pcmToWav(pcmData: Buffer, sampleRate: number, numChannels: number, bitsPerSample: number): Buffer {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const headerSize = 44;
  const wavBuffer = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  wavBuffer.write('RIFF', 0);
  wavBuffer.writeUInt32LE(36 + dataSize, 4);
  wavBuffer.write('WAVE', 8);

  // fmt chunk
  wavBuffer.write('fmt ', 12);
  wavBuffer.writeUInt32LE(16, 16);           // chunk size
  wavBuffer.writeUInt16LE(1, 20);            // PCM format
  wavBuffer.writeUInt16LE(numChannels, 22);  // channels
  wavBuffer.writeUInt32LE(sampleRate, 24);   // sample rate
  wavBuffer.writeUInt32LE(byteRate, 28);     // byte rate
  wavBuffer.writeUInt16LE(blockAlign, 32);   // block align
  wavBuffer.writeUInt16LE(bitsPerSample, 34);// bits per sample

  // data chunk
  wavBuffer.write('data', 36);
  wavBuffer.writeUInt32LE(dataSize, 40);
  pcmData.copy(wavBuffer, 44);

  return wavBuffer;
}
