import { getProviderStatus, getAvailableModels, validateApiKey } from '@/core/models';

/**
 * GET /api/models — Returns available models and provider status.
 * API keys are NEVER included in the response.
 */
export async function GET() {
  try {
    const providerStatus = getProviderStatus();
    const availableModels = getAvailableModels();
    
    return Response.json({
      providers: providerStatus.map(p => ({
        // Only expose non-sensitive metadata
        id: p.id,
        name: p.name,
        available: p.available,
        modelCount: p.modelCount,
        hasCustomKey: p.hasCustomKey,
        // NEVER include: apiKey, baseUrl (internal)
      })),
      models: availableModels.map(m => ({
        provider: m.provider,
        name: m.model.name,
        id: m.model.id,
        strengths: m.model.strengths,
        speed: m.model.speed,
        quality: m.model.quality,
        brainTypes: m.model.brainTypes,
        // NEVER include: apiKey, contextWindow (internal)
      })),
      totalModels: availableModels.length
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/models — Validate an API key or get provider status.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    if (body.action === 'validate' && body.providerId && body.apiKey) {
      const result = await validateApiKey(body.providerId, body.apiKey);
      return Response.json(result);
    }
    
    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
