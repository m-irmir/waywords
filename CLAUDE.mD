# Architecture & Stack
* Framework: Next.js 16 (App Router)
* Language: JavaScript (No TypeScript)
* Styling: Vanilla CSS (globals.css), CSS Variables. No UI libraries.
* Database: Upstash Redis (`@upstash/redis`)

# File Structure
* `/app/page.js`: Client UI. Renders 7 inputs, handles submission state, displays final score and top 10 leaderboard.
* `/app/api/score/route.js`: Server endpoint. Handles OpenAI API fetching, math, and Redis database writes/reads.
* `/utils/math.js`: Pure functions for cosine similarity and distance averaging.

# Strict Constraints & Technical Context
* NEVER use external state management or UI libraries.
* **Validation:** Client MUST validate inputs are single lowercase words (no spaces/hyphens) before hitting the API.
* **Math:** Compute cosine similarity. ALWAYS clamp values to `[-1, 1]` due to floating-point precision before calculating distance `(1 - similarity)`. Calculate for all unique pairs and return the average.
* **API Handling:** `text-embedding-3-small` returns an `index` property. ALWAYS sort the array by `index` before executing math.
* **Database Logic:** Use Redis `ZADD` to add the user's run to a sorted set leaderboard. Use `ZREVRANGE` to fetch the top 10 global scores to return to the client alongside their personal score.

# Commands
* Install: `npm install`
* Dev: `npm run dev`