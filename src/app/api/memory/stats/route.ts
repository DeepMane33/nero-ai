import { getMemoryStats } from '@/lib/db';

export async function GET() {
  try {
    const stats = getMemoryStats();
    return Response.json(stats);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
