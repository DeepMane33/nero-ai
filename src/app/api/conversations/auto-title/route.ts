import { NextRequest } from 'next/server';
import { getMessages, updateConversation, getUserId } from '@/lib/db';
import { setCustomApiKey } from '@/core/models';

export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const { conversationId } = await request.json();

    if (!conversationId) {
      return Response.json({ error: 'conversationId is required' }, { status: 400 });
    }

    const clientApiKey = request.headers.get('x-api-key') || undefined;
    if (clientApiKey) setCustomApiKey('gemini', clientApiKey);

    const apiKey = process.env.GEMINI_API_KEY || clientApiKey;
    if (!apiKey) {
      return Response.json({ error: 'No API key configured.' }, { status: 500 });
    }

    const messages = getMessages(conversationId, userId);
    if (!messages || messages.length === 0) {
      return Response.json({ error: 'No messages found in conversation' }, { status: 404 });
    }

    const contextText = messages.slice(0, 3).map((m: { role: string; content: string }) => m.role + ': ' + m.content).join('\n');

    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    url.searchParams.set('key', apiKey);

    const geminiResponse = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: 'Generate a very short title (5-7 words max) for this conversation. Reply with ONLY the title, no quotes, no punctuation at the end.\n\nConversation:\n' + contextText }],
        }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 30 },
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      return Response.json({ error: 'Failed to generate title' }, { status: 502 });
    }

    const data = await geminiResponse.json();
    const title = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!title) {
      return Response.json({ error: 'No title generated' }, { status: 502 });
    }

    updateConversation(conversationId, { title }, userId);

    return Response.json({ title, conversationId });
  } catch (error) {
    console.error('Error generating auto-title:', error);
    return Response.json({ error: 'Failed to generate title' }, { status: 500 });
  }
}
