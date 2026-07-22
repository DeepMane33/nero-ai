import { personalities, type PersonalityType } from '@/core/personalities';

/**
 * GET /api/personality — list available personalities
 * POST /api/personality — validate a personality type
 */

export async function GET() {
  const list = Object.values(personalities).map((p) => ({
    type: p.type,
    name: p.name,
    emoji: p.emoji,
    description: p.description,
  }));

  return Response.json({ personalities: list, default: 'normal' });
}

export async function POST(request: Request) {
  try {
    const { personality } = await request.json();

    if (!personality || !(personality in personalities)) {
      return Response.json(
        { error: `Invalid personality. Available: ${Object.keys(personalities).join(', ')}` },
        { status: 400 }
      );
    }

    const p = personalities[personality as PersonalityType];
    return Response.json({
      type: p.type,
      name: p.name,
      emoji: p.emoji,
      description: p.description,
    });
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
