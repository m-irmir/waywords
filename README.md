# DAT Clone (Modernized)

A modernized recreation of the Divergent Association Task (DAT). Users input 10 unrelated nouns, and the application calculates their semantic distance to measure divergent thinking.

### Core Flow
1. User sees 7 empty text inputs.
2. User enters 7 single English nouns (no proper nouns, no specialized vocabulary).
3. On submit, the client sends the words to the server.
4. The server fetches 1536-dimensional embeddings for all 10 words using OpenAI's `text-embedding-3-small`.
5. The server calculates the cosine distance between every unique pair of words.
6. The server averages these distances, scales the result, and returns the score to the client.
7. Display a grid featuring the distance from each pair of words as well as a total score at the top, color coding scores (green=high, pale green=decent, yellow=mid)

### Tech Stack
* **Frontend:** Next.js 16 (App Router), React, Vanilla CSS
* **Backend:** Next.js Route Handlers (`/app/api/score/route.js`)
* **AI:** OpenAI API (`text-embedding-3-small`)