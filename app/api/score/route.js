import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Redis } from '@upstash/redis';
import { averageDistance, cosineDistance, scaleScore } from '../../../utils/math';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function isRealWord(word) {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
    return res.ok;
  } catch {
    return true; // fail open if the dictionary API is unreachable
  }
}

export async function GET() {
  try {
    const raw = await redis.zrange('leaderboard', 0, 9, { rev: true });
    const leaderboard = raw.map((entry) => {
      if (typeof entry === 'string') return JSON.parse(entry);
      return entry;
    });
    return NextResponse.json({ leaderboard });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { words: rawWords } = await request.json();
    const words = Array.isArray(rawWords) ? rawWords.map((w) => w.toLowerCase()) : rawWords;

    if (!Array.isArray(words) || words.length !== 7) {
      return NextResponse.json({ error: 'Exactly 7 words required.' }, { status: 400 });
    }

    // Validate all words against dictionary in parallel
    const checks = await Promise.all(words.map((w) => isRealWord(w)));
    const invalidWords = words.filter((_, i) => !checks[i]);
    if (invalidWords.length > 0) {
      return NextResponse.json(
        { error: `Not a valid word: ${invalidWords.join(', ')}`, invalidWords },
        { status: 400 }
      );
    }

    // Fetch embeddings for all 7 words in a single batch request
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: words,
    });

    // Sort by index to ensure correct order
    const sorted = response.data.slice().sort((a, b) => a.index - b.index);
    const embeddings = sorted.map((item) => item.embedding);

    // Compute all 21 pair distances
    const pairDistances = [];
    for (let i = 0; i < words.length; i++) {
      for (let j = i + 1; j < words.length; j++) {
        const distance = cosineDistance(embeddings[i], embeddings[j]);
        const scaledPairScore = scaleScore(distance);
        pairDistances.push({
          word1: words[i],
          word2: words[j],
          i,
          j,
          distance,
          scaledScore: scaledPairScore,
        });
      }
    }

    // Compute overall score
    const avgDist = averageDistance(embeddings);
    const finalScore = Math.round(scaleScore(avgDist));

    // Write to Redis leaderboard — sort words for a canonical key so the same
    // word set (regardless of submission order) is always one entry.
    const canonicalWords = words.slice().sort();
    const member = JSON.stringify({ words: canonicalWords, score: finalScore });
    const added = await redis.zadd('leaderboard', { score: finalScore, member }, { nx: true });
    if (added === 0) {
      return NextResponse.json({ error: 'This set of words is already on the leaderboard.' }, { status: 409 });
    }

    // Read top 10
    const raw = await redis.zrange('leaderboard', 0, 9, { rev: true });
    const leaderboard = raw.map((entry) => {
      if (typeof entry === 'string') return JSON.parse(entry);
      return entry;
    });

    return NextResponse.json({ score: finalScore, pairDistances, leaderboard });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
