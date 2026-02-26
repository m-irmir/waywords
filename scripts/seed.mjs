// ─── Paste your word sets here ────────────────────────────────────────────────
const ENTRIES = [
  // from full leaderboard dump
  ['bee', 'bee', 'bee', 'bee', 'bee', 'bee', 'hive'],
  ['bee', 'bee', 'bee', 'bee', 'bee', 'honey', 'hive'],
  ['soup', 'soup', 'soup', 'soup', 'soup', 'soup', 'soup'],
  ['rabbit', 'jet', 'rice', 'ash', 'cloud', 'supernova', 'mineral'],
  ['estuary', 'dog', 'transistor', 'sign', 'kobold', 'positron', 'butt'],
  ['hades', 'spoon', 'dock', 'refraction', 'teeth', 'sabre', 'dumpling'],
  ['table', 'excavator', 'rock', 'scarf', 'cytometer', 'toe', 'branch'],
  ['lumber', 'dolphin', 'astronaut', 'foyer', 'concoction', 'aqueduct', 'honey'],
  ['game', 'bellicose', 'tree', 'didactic', 'merging', 'recompense', 'carefully'],
  ['orrery', 'kerfuffle', 'antimacassar', 'gossamer', 'catamaran', 'quicksilver', 'scofflaw'],
  ['congress', 'sneeze', 'dallying', 'persnickety', 'lemming', 'autograph', 'motherboard'],
  ['cow', 'fly', 'tabla', 'astronaut', 'sourdough', 'quantity', 'database'],
  ['jackrabbit', 'virtue', 'subpoena', 'dumpling', 'simile', 'hemoglobin', 'atelier'],
  ['ego', 'karate', 'coconut', 'freight', 'rampart', 'archipelago', 'cerebellum'],
  ['supernova', 'mineral', 'tuberculosis', 'firearm', 'kimchi', 'hovel', 'superconductor'],
  ['supernova', 'atom', 'tuberculosis', 'firearm', 'kimchi', 'hovel', 'ideology'],
  ['cubicle', 'cholera', 'vandal', 'cheeseburger', 'superego', 'gong', 'arcana'],
  ['supernova', 'mineral', 'tuberculosis', 'spirit', 'kimchi', 'hovel', 'ideology'],
  ['supernova', 'soul', 'tuberculosis', 'firearm', 'kimchi', 'hovel', 'ideology'],
  ['map', 'singularity', 'exigence', 'quality', 'flamethrower', 'antidisestablishmentarianism', 'fable'],
  ['supernova', 'mineral', 'tuberculosis', 'firearm', 'kimchi', 'hovel', 'ideology'],
  ['supernova', 'producer', 'tuberculosis', 'firearm', 'kimchi', 'hovel', 'ideology'],
  // not in dump, recovered separately
  ['outcropping', 'fart', 'ideology', 'kimchi', 'tuberculosis', 'producer', 'photosynthesis'],
  ['astrologer', 'buttermilk', 'coastline', 'execution', 'loupe', 'mulch', 'trench'],
  ['ammonia', 'annihilation', 'camaraderie', 'fingernail', 'hippocampus', 'infidelity', 'meme'],
];
// ──────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Load .env.local
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const eq = line.indexOf('=');
  if (eq > 0) {
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] = val;
  }
}

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisCommand(...args) {
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function averageDistance(embeddings) {
  let total = 0, count = 0;
  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      const sim = cosineSimilarity(embeddings[i], embeddings[j]);
      total += 1 - Math.max(-1, Math.min(1, sim));
      count++;
    }
  }
  return count === 0 ? 0 : total / count;
}

function scaleScore(avgDist) {
  const center = 0.63;
  const steepness = 10.5;
  return parseFloat((1 / (1 + Math.exp(-steepness * (avgDist - center))) * 100).toFixed(2));
}

if (ENTRIES.length === 0) {
  console.error('No entries defined. Add word sets to the ENTRIES array at the top of the script.');
  process.exit(1);
}

console.log(`Seeding ${ENTRIES.length} entries...\n`);
let succeeded = 0;

for (const words of ENTRIES) {
  if (words.length !== 7) {
    console.warn(`SKIP  ${words.join(', ')} — needs exactly 7 words, got ${words.length}`);
    continue;
  }

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: words }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);

    const embeddings = json.data
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);

    const score = scaleScore(averageDistance(embeddings));
    const canonicalWords = words.slice().sort();
    const member = JSON.stringify({ words: canonicalWords, score });

    const existing = await redisCommand('ZSCORE', 'leaderboard', member);
    if (existing !== null) {
      console.log(`SKIP  [${score}] ${words.join(', ')} — already on leaderboard`);
      continue;
    }

    await redisCommand('ZADD', 'leaderboard', score, member);
    console.log(`OK    [${score}] ${words.join(', ')}`);
    succeeded++;
  } catch (err) {
    console.error(`FAIL  ${words.join(', ')} — ${err.message}`);
  }
}

console.log(`\nDone. ${succeeded}/${ENTRIES.length} entries added.`);
