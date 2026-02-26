import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Redis } from '@upstash/redis';
import { averageDistance, scaleScore } from '../../../utils/math';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (!process.env.MIGRATE_SECRET || secret !== process.env.MIGRATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    // Read every entry (not just top 10)
    const raw = await redis.zrange('leaderboard', 0, -1, { rev: true });
    const entries = raw.map((entry) => {
      if (typeof entry === 'string') return JSON.parse(entry);
      return entry;
    });

    if (entries.length === 0) {
      return NextResponse.json({ message: 'Leaderboard is already empty.', migrated: [] });
    }

    // Re-embed and re-score each entry sequentially (avoids rate limits)
    const migrated = [];
    for (const entry of entries) {
      const { words } = entry;

      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: words,
      });

      const sorted = response.data.slice().sort((a, b) => a.index - b.index);
      const embeddings = sorted.map((item) => item.embedding);

      const avgDist = averageDistance(embeddings);
      const newScore = Math.round(scaleScore(avgDist));

      migrated.push({ words, oldScore: entry.score, newScore });
    }

    // Clear and rebuild leaderboard with new scores
    await redis.del('leaderboard');
    for (const { words, newScore } of migrated) {
      const member = JSON.stringify({ words, score: newScore });
      await redis.zadd('leaderboard', { score: newScore, member });
    }

    return NextResponse.json({ message: `Migrated ${migrated.length} entries.`, migrated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Migration failed: ' + err.message }, { status: 500 });
  }
}
