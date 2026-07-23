import { routeToBrain, getBrainPrompt } from '@/core/brain-router';
import { detectPersonalitySwitch, getPersonality, type PersonalityType } from '@/core/personalities';
import { selectModel, callWithFailover, getAvailableModels, setCustomApiKey, removeCustomApiKey, getCustomApiKey } from '@/core/models';
import { createConversation, getMessages, createMessage, updateConversation, createEmotionalState, logActivity, getUserId } from '@/lib/db';
import { extractFacts, storeFacts, getRelevantMemories, formatMemoryContext } from '@/lib/memory-extractor';
import { analyzeSentiment } from '@/lib/sentiment';
import { extractAndStoreKnowledge } from '@/lib/knowledge-extractor';
import { searchWeb, needsWebSearch, fetchPageContent } from '@/lib/web-search';
import { getNewsContextForLLM, ensureDailyNews } from '@/lib/news-fetcher';
import { getSportsContext } from '@/lib/sports-search';
import { getWeather, getWikipediaSummary, detectFreeAPI } from '@/lib/free-apis';
import { getRelevantCorrections, formatCorrectionContext } from '@/lib/feedback';
import { getToolDefinitionsForPrompt, parseToolCalls } from '@/core/tools';
import { executeTool } from '@/core/tool-executor';
import { analyzeConfidence, formatConfidenceMetadata } from '@/lib/confidence';
import { autoDetectPreferences, getPersonalizationContext } from '@/lib/personalization';
import { getEmotionalContext, detectMoodShift, getMoodSuggestions } from '@/lib/emotional-intelligence';

export const maxDuration = 90;

const MAX_CONTEXT_TOKENS = 8000;
const MAX_HISTORY_MESSAGES = 10;
const CHARS_PER_TOKEN = 4;
const SEARCH_DEFAULTS: [any[], string, null, string] = [[], '', null, ''];

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function trimMessages(
  messages: { role: string; content: string }[],
  maxTokens: number
): { role: string; content: string }[] {
  const trimmed = messages.slice(-MAX_HISTORY_MESSAGES);
  let totalTokens = 0;
  const result: { role: string; content: string }[] = [];
  for (let i = trimmed.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokens(trimmed[i].content);
    if (totalTokens + msgTokens > maxTokens && result.length > 0) break;
    totalTokens += msgTokens;
    result.unshift(trimmed[i]);
  }
  return result;
}

async function generateTitle(message: string): Promise<string> {
  try {
    const result = selectModel('memory');
    if (!result) return message.slice(0, 50);
    
    const { provider, model } = result;
    const apiKey = provider.apiKey;
    if (!apiKey) return message.slice(0, 50);
    
    let response: Response;
    
    if (provider.format === 'gemini') {
      response = await fetch(`${provider.baseUrl}/models/${model.id}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: message }] }],
          systemInstruction: { parts: [{ text: 'Generate a very short title (5-7 words max) for this conversation. Reply with ONLY the title, no quotes, no punctuation at the end.' }] },
          generationConfig: { temperature: 0.3, maxOutputTokens: 30 }
        })
      });
    } else {
      response = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          ...(provider.name === 'OpenRouter' ? { 'HTTP-Referer': 'https://nero-ai.local', 'X-Title': 'Nero AI' } : {})
        },
        body: JSON.stringify({
          model: model.id,
          messages: [
            { role: 'system', content: 'Generate a very short title (5-7 words max) for this conversation. Reply with ONLY the title, no quotes, no punctuation at the end.' },
            { role: 'user', content: message }
          ],
          temperature: 0.3,
          max_tokens: 30
        })
      });
    }
    
    if (!response.ok) return message.slice(0, 50);
    const data = await response.json();
    
    let content: string;
    if (provider.format === 'gemini') {
      content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    } else {
      content = data.choices?.[0]?.message?.content?.trim() || '';
    }
    
    return content || message.slice(0, 50);
  } catch {
    return message.slice(0, 50);
  }
}

export async function POST(request: Request) {
  try {
    const { message, conversationId: inputConvId, brainType, personality: inputPersonality, apiKey: clientApiKey, fallbackKey: clientFallbackKey, clientMemories } = await request.json();
    const userId = getUserId(request);

    if (!message || typeof message !== 'string') {
      return Response.json({ error: 'Message is required' }, { status: 400 });
    }

    // Store client keys temporarily for this request (used by selectModel/callWithFailover)
    if (clientApiKey && typeof clientApiKey === 'string') {
      setCustomApiKey('gemini', clientApiKey);
    }
    if (clientFallbackKey && typeof clientFallbackKey === 'string') {
      setCustomApiKey('gemini_fallback', clientFallbackKey);
    }

    // Check if we have a key
    const hasKey = !!(process.env.GEMINI_API_KEY || clientApiKey);
    if (!hasKey) {
      return Response.json({
        error: 'No API key configured. Go to Settings and add your Gemini API key.'
      }, { status: 500 });
    }

    const detectedSwitch = detectPersonalitySwitch(message);
    const activePersonality: PersonalityType = detectedSwitch || inputPersonality || 'normal';
    const personality = getPersonality(activePersonality);

    const route = routeToBrain(message, activePersonality);
    const detectedType = brainType || route.brainType;

    // Start with a clean prompt — search results go FIRST for maximum visibility
    let systemPrompt = '';

    // Run ALL external calls in parallel for speed
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const freeAPIs = detectFreeAPI(message);
    const isSports = /\b(fifa|world cup|soccer|football|ipl|cricket|t20|nba|nfl|basketball|match|score|game|team|winner|champion|standings|points.?table)\b/i.test(message);
    const isWiki = /\b(who (is|was)|what is|what are|explain|tell me about|define|meaning of)\b/i.test(message);
    const wikiMatch = isWiki ? message.match(/(?:who (?:is|was)|what is|what are|explain|tell me about|define|meaning of)\s+(.+?)(?:\?|$)/i) : null;

    // Fire all external calls simultaneously with 12s timeout (page content fetching takes longer)
    const searchPromise = needsWebSearch(message) ? searchWeb(message).catch(() => []) : Promise.resolve([]);
    const sportsPromise = isSports ? getSportsContext(message).catch(() => '') : Promise.resolve('');
    const weatherPromise = (freeAPIs.isWeather && freeAPIs.weatherLocation) ? getWeather(freeAPIs.weatherLocation).catch(() => null) : Promise.resolve(null);
    const wikiPromise = (isWiki && wikiMatch) ? getWikipediaSummary(wikiMatch[1].trim()).catch(() => '') : Promise.resolve('');

    // Wait for all with 12s max
    const results = await Promise.race([
      Promise.all([searchPromise, sportsPromise, weatherPromise, wikiPromise]),
      new Promise<typeof SEARCH_DEFAULTS>((resolve) => setTimeout(() => resolve(SEARCH_DEFAULTS), 12000)),
    ]);
    const [searchResults, sportsContext, weather, wikiSummary] = results;

    // Build search context — with page content for richer answers
    let searchContext = '';
    if (needsWebSearch(message)) {
      if (searchResults.length > 0) {
        const webParts: string[] = [];
        for (let i = 0; i < searchResults.length; i++) {
          const r = searchResults[i] as any;
          let entry = `[${i + 1}] ${r.title}\n    URL: ${r.url}`;
          if (r.snippet) entry += `\n    Snippet: ${r.snippet}`;
          if (r.content) entry += `\n    Page Content: ${r.content.slice(0, 800)}`;
          webParts.push(entry);
        }
        const webContext = webParts.join('\n\n');
        searchContext = `\n\n🔍 REAL-TIME WEB SEARCH RESULTS for "${message}" (${dateStr}):\n${webContext}\n\n⚠️ ANSWER INSTRUCTIONS:\n- Answer the user's question DIRECTLY. Give a complete, informative answer — not just one sentence.\n- Include relevant context: who scored, key moments, venue, date, significance of the match.\n- Do NOT repeat the same fact multiple times.\n- Do NOT end with "for more information visit..." — that's useless filler.\n- Do NOT use bracket citations like [1] or [2] — they look broken. Instead, naturally mention sources (e.g., "according to reports" or just state the fact).\n- Make it sound natural and conversational, like a knowledgeable friend explaining.`;
      } else {
        searchContext = `\n\n⚠️ Searched the web for "${message}" but found no results. Answer based on your training knowledge, but note that you were unable to verify the information in real-time.`;
      }
    }

    // Build sports context
    const sportsCtx = sportsContext ? `\n\n${sportsContext}` : '';

    // Build weather context
    let weatherCtx = '';
    if (weather) {
      weatherCtx = `\n\n🌤️ LIVE WEATHER — ${weather.location}:\n${weather.icon} ${weather.description} | ${weather.temp}°C (feels ${weather.feelsLike}°C) | Humidity: ${weather.humidity}% | Wind: ${weather.windSpeed} km/h`;
    }

    // Build Wikipedia context
    const wikiCtx = wikiSummary ? `\n\n📚 WIKIPEDIA — ${wikiMatch?.[1]?.trim() || ''}:\n${wikiSummary}` : '';

    // Inject cached daily news — fire and forget, use whatever is cached
    let newsContext = '';
    try {
      ensureDailyNews().catch(() => {}) // don't block the request
      newsContext = getNewsContextForLLM()
    } catch {}

    // Build the full system prompt: all data FIRST, then personality
    systemPrompt = `${searchContext}${sportsCtx}${weatherCtx}${wikiCtx}${newsContext}\n\n${getBrainPrompt(detectedType, activePersonality)}`;

    if (detectedSwitch) {
      const switchNote = detectedSwitch === 'waifu'
        ? `\n\n[SYSTEM: The user just asked you to switch to waifu/anime personality mode. You are now in ${personality.name} mode (${personality.description}). Embody this personality fully from this point forward.]`
        : `\n\n[SYSTEM: The user just asked you to switch back to normal professional assistant mode. You are now in ${personality.name} mode (${personality.description}). Drop the waifu persona.]`;
      systemPrompt += switchNote;
    }

    systemPrompt += `\n\nANSWER STYLE:\n- Be INFORMATIVE. Give a complete answer with context — scores, key players, important moments, venue.\n- Write 2-4 sentences for factual questions, more for complex topics.\n- No repetition. No redundant bullet points. No filler phrases.\n- Never use bracket citations like [1] or [2] — they look broken to the user. Just state facts naturally.\n- Never end with "for more information..." or "you can visit..." — just answer.\n- Sound like a knowledgeable friend, not a robot.\n\nCONVERSATIONAL CONTEXT RULES:\n- Understand context from the conversation flow. If you asked "what's your name?" and the user says "its deep", they mean their name is Deep. Don't interpret it as talking about DeepSeek or depth.\n- Short messages like "ok", "sure", "its [name]", "im [location]" should be understood in context, not analyzed literally.\n- When the user shares personal information, save it with save_memory and respond warmly.\n- NEVER output raw JSON tool calls as part of your visible response. Tools are handled silently by the system.`;

    // Add tool definitions
    systemPrompt += `\n\n${getToolDefinitionsForPrompt()}`;

    let conversationId = inputConvId;
    let isNewConversation = false;
    if (!conversationId) {
      const conv = createConversation('New Chat', detectedType, userId);
      conversationId = conv.id;
      isNewConversation = true;
      logActivity('chat', 'New conversation', 'Started a new chat', 'conversation', conversationId, undefined, userId);
    }

    createMessage(conversationId, 'user', message, userId);

    const facts = extractFacts(message);
    if (facts.length > 0) {
      storeFacts(facts, userId);
      // Log memory activity
      for (const fact of facts) {
        logActivity('memory', `Saved ${fact.category}`, `${fact.key}: ${fact.value}`, 'memory', undefined, undefined, userId);
      }
    }

    const memories = getRelevantMemories(message, 5, userId);
    const memoryContext = formatMemoryContext(memories);
    if (memoryContext) systemPrompt += memoryContext;

    // Add project context so Nero knows about user's projects
    try {
      const { getProjects: getProjectsFn } = await import('@/lib/db')
      const projects = getProjectsFn(userId)
      if (projects.length > 0) {
        const projectList = projects.map((p: any) => `- ${p.name}: ${p.description || 'No description'} (${p.status})`).join('\n')
        systemPrompt += `\n\n## User's Projects\nThe user has these projects:\n${projectList}`
      }
    } catch {}

    // Inject past corrections and feedback
    const corrections = getRelevantCorrections(message, 3);
    const correctionContext = formatCorrectionContext(corrections);
    if (correctionContext) systemPrompt += correctionContext;

    // Add personalization context
    const personalizationContext = getPersonalizationContext();
    if (personalizationContext) systemPrompt += personalizationContext;

    // Add client-side memories (stored in user's browser)
    if (clientMemories) {
      systemPrompt += `\n\n## What You Know About This User\nThe user has shared these facts about themselves (stored in their browser memory):\n${clientMemories}\n\nUse this information naturally in conversation. If they share new personal info (name, location, preferences, etc), acknowledge it warmly.`;
    }

    // Add emotional intelligence context
    const emotionalContext = getEmotionalContext();
    if (emotionalContext) systemPrompt += emotionalContext;

    const history = getMessages(conversationId);
    const recentHistory = history.slice(-20);
    const trimmedHistory = trimMessages(
      recentHistory.map((m: any) => ({ role: m.role, content: m.content })),
      MAX_CONTEXT_TOKENS - estimateTokens(systemPrompt)
    );

    const modelMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...trimmedHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: message }
    ];

    const encoder = new TextEncoder();
    let fullResponse = '';
    let usedProvider = '';
    let usedModel = '';

    const stream = new ReadableStream({
      async start(controller) {
        const selectedModel = selectModel(detectedType);
        const meta = JSON.stringify({
          conversationId,
          brainUsed: detectedType,
          personality: activePersonality,
          personalityName: personality.name,
          personalityEmoji: personality.emoji,
          provider: selectedModel?.provider.name || 'Unknown',
          model: selectedModel?.model.name || 'Unknown',
          availableModels: 1
        });
        controller.enqueue(encoder.encode(`data: ${meta}\n\n`));

        try {
          const result = await callWithFailover(detectedType, modelMessages, {
            onToken: (token) => {
              fullResponse += token;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: token })}\n\n`));
            },
            onComplete: (response) => {
              fullResponse = response;
            },
            onError: (error) => {
              console.error('Model error:', error.message);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
            }
          });

          usedProvider = result.provider;
          usedModel = result.model;
        } catch (err: any) {
          console.error('All models failed:', err?.message || err);
          const errorMsg = err?.message?.includes('API key') || err?.message?.includes('No API key')
            ? 'No valid API keys found. Please go to Settings and add your Gemini API key.'
            : err?.message?.includes('empty response')
            ? `Nero received an empty response from the AI. This usually means:\n• Your API key may be invalid or expired\n• The free tier quota may be exceeded\n• Content was blocked by safety filters\n\nPlease check your API key in Settings or try again.`
            : `AI service unavailable: ${err?.message || 'Unknown error'}. Please try again.`;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`));
        }

        if (fullResponse) {
          // Check for tool calls in the response
          const toolCalls = parseToolCalls(fullResponse);
          let finalResponse = fullResponse;

          if (toolCalls.length > 0) {
            // Strip tool call JSON from the displayed response
            let cleanResponse = fullResponse;
            for (const tc of toolCalls) {
              const jsonMatch = cleanResponse.match(/```json\s*\n?\s*\{[\s\S]*?\}\s*\n?\s*```/);
              if (jsonMatch) cleanResponse = cleanResponse.replace(jsonMatch[0], '').trim();
            }
            // Also strip standalone JSON tool calls
            cleanResponse = cleanResponse.replace(/\{"tool":\s*"save_memory"[\s\S]*?\}/g, '').replace(/\{"tool":\s*"[^"]*"[\s\S]*?\}/g, '').trim();
            if (cleanResponse) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: cleanResponse })}\n\n`));
            }

            let toolResults = '';
            for (const tc of toolCalls) {
              const result = await executeTool(tc.tool, tc.params, conversationId);
              if (result.success) {
                toolResults += `\n\n[Tool Result: ${tc.tool}]\n${result.result}`;
              } else {
                toolResults += `\n\n[Tool Error: ${tc.tool}] ${result.error}`;
              }
            }

            // If there were tool calls, send the results back for a follow-up response
            if (toolResults) {
              // Send tool results to client
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ toolResults })}\n\n`));

              // Make a follow-up call with tool results
              const followUpMessages = [
                ...modelMessages,
                { role: 'assistant' as const, content: fullResponse },
                { role: 'user' as const, content: `Tool execution results:${toolResults}\n\nPlease incorporate these results into a helpful response to the original question: "${message}"` },
              ];

              let followUpResponse = '';
              try {
                await callWithFailover(detectedType, followUpMessages, {
                  onToken: (token) => {
                    followUpResponse += token;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: token })}\n\n`));
                  },
                  onComplete: (response) => {
                    followUpResponse = response;
                  },
                  onError: (error) => {
                    console.warn('Follow-up call failed:', error.message);
                  }
                });
                if (followUpResponse) {
                  finalResponse = followUpResponse;
                }
              } catch {
                // If follow-up fails, use original response with tool results appended
                finalResponse = fullResponse + toolResults;
              }
            }
          }

          createMessage(conversationId, 'assistant', finalResponse, userId);
          if (isNewConversation) {
            // Fire and forget — don't block the stream for title generation
            generateTitle(message)
              .then(title => updateConversation(conversationId!, { title }))
              .catch(() => {});
          }
          logActivity('chat', `Chat: ${detectedType} [${activePersonality}] via ${usedProvider}/${usedModel}`, message.slice(0, 100), 'conversation', conversationId);

          try {
            const userSentiment = analyzeSentiment(message);
            const assistantSentiment = analyzeSentiment(fullResponse);
            const blended = {
              mood: assistantSentiment.mood,
              sentiment: Math.round((assistantSentiment.sentiment * 0.6 + userSentiment.sentiment * 0.4) * 100) / 100,
              valence: Math.round((assistantSentiment.valence * 0.6 + userSentiment.valence * 0.4) * 100) / 100,
              arousal: Math.round((assistantSentiment.arousal * 0.6 + userSentiment.arousal * 0.4) * 100) / 100,
              dominantEmotion: assistantSentiment.dominantEmotion,
              emoji: assistantSentiment.emoji,
            };
            createEmotionalState(
              blended.mood, blended.sentiment, blended.valence, blended.arousal,
              blended.dominantEmotion, blended.emoji,
              message.slice(0, 200), conversationId
            );
          } catch (sentimentErr) {
            console.warn('[chat] Sentiment analysis failed:', sentimentErr);
          }

          try {
            const knowledge = extractAndStoreKnowledge(message, fullResponse, userId);
            if (knowledge.nodesAdded > 0 || knowledge.edgesAdded > 0) {
              logActivity('knowledge', 'Knowledge extracted',
                `+${knowledge.nodesAdded} nodes, +${knowledge.edgesAdded} edges`,
                'conversation', conversationId, undefined, userId);
            }
          } catch (knowledgeErr) {
            console.warn('[chat] Knowledge extraction failed:', knowledgeErr);
          }

          // Auto-detect user preferences from conversation
          try {
            const recentMessages = getMessages(conversationId).slice(-10).map(m => m.content)
            autoDetectPreferences(recentMessages)
          } catch (prefErr) {
            console.warn('[chat] Preference detection failed:', prefErr);
          }

          // Analyze confidence of the response
          try {
            const hasToolResults = toolCalls.length > 0;
            const confidence = analyzeConfidence(finalResponse, {
              usedWebSearch: needsWebSearch(message),
              usedMemory: memories.length > 0,
              memoryRelevance: memories.length > 0 ? 0.6 : 0,
              hasToolResults,
            });
            const confidenceMeta = formatConfidenceMetadata(confidence);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ confidence: confidenceMeta })}\n\n`));
          } catch (confErr) {
            console.warn('[chat] Confidence analysis failed:', confErr);
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    });
  } catch (err: any) {
    console.error('Chat error:', err);
    return Response.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
