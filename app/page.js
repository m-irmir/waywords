'use client';

import { useState } from 'react';

const WORD_COUNT = 7;
const WORD_REGEX = /^[a-z]+$/;

const COLOR_STOPS = [
  { at: 0,   r: 239, g: 154, b: 154 }, // pale red
  { at: 30,  r: 255, g: 241, b: 118 }, // yellow
  { at: 60,  r: 165, g: 214, b: 167 }, // pale green
  { at: 100, r: 76,  g: 175, b: 80  }, // dark green
];

function scoreToColor(score) {
  const s = Math.max(0, Math.min(100, score));
  let lo = COLOR_STOPS[0];
  let hi = COLOR_STOPS[COLOR_STOPS.length - 1];
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    if (s >= COLOR_STOPS[i].at && s <= COLOR_STOPS[i + 1].at) {
      lo = COLOR_STOPS[i];
      hi = COLOR_STOPS[i + 1];
      break;
    }
  }
  const t = (s - lo.at) / (hi.at - lo.at);
  const r = Math.round(lo.r + t * (hi.r - lo.r));
  const g = Math.round(lo.g + t * (hi.g - lo.g));
  const b = Math.round(lo.b + t * (hi.b - lo.b));
  return `rgb(${r}, ${g}, ${b})`;
}

export default function Home() {
  const [words, setWords] = useState(Array(WORD_COUNT).fill(''));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [invalidFields, setInvalidFields] = useState([]);

  function handleChange(index, value) {
    const updated = [...words];
    updated[index] = value;
    setWords(updated);
    // Clear invalid flag for this field if they're typing
    if (invalidFields.includes(index)) {
      setInvalidFields(invalidFields.filter((i) => i !== index));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    // Client-side validation
    const invalid = [];
    for (let i = 0; i < WORD_COUNT; i++) {
      if (!WORD_REGEX.test(words[i])) {
        invalid.push(i);
      }
    }
    if (invalid.length > 0) {
      setInvalidFields(invalid);
      setError('All words must be single lowercase letters only (a–z), no spaces or hyphens.');
      return;
    }

    setInvalidFields([]);
    setLoading(true);

    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        if (data.invalidWords) {
          const badSet = new Set(data.invalidWords);
          setInvalidFields(words.map((w, i) => badSet.has(w) ? i : -1).filter((i) => i !== -1));
        }
      } else {
        setResult(data);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setWords(Array(WORD_COUNT).fill(''));
    setResult(null);
    setError(null);
    setInvalidFields([]);
  }

  // Build a lookup map: "i-j" -> pairData
  function buildPairMap(pairDistances) {
    const map = {};
    for (const pd of pairDistances) {
      map[`${pd.i}-${pd.j}`] = pd;
    }
    return map;
  }

  if (result) {
    const pairMap = buildPairMap(result.pairDistances);
    const usedWords = result.leaderboard[0]?.words ?? words;

    return (
      <main>
        <h1>Divergent Association Task</h1>
        <p className="subtitle">How semantically distant were your words?</p>

        <div className="results">
          {/* Score Card */}
          <div className="score-card">
            <div className="score-label">Your Score</div>
            <div className="score-number">{result.score}</div>
            <div className="score-words">{words.join(' · ')}</div>
          </div>

          {/* Pair Grid */}
          <div className="pair-grid-section">
            <h2>Pair Distances</h2>
            <div className="pair-grid-wrapper">
              <table className="pair-grid">
                <thead>
                  <tr>
                    <th></th>
                    {words.map((w, i) => (
                      <th key={i}>{w}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {words.map((rowWord, i) => (
                    <tr key={i}>
                      <th>{rowWord}</th>
                      {words.map((colWord, j) => {
                        if (j >= i) {
                          // upper triangle + diagonal: empty
                          return <td key={j} className="empty"></td>;
                        }
                        // lower triangle: pair data
                        const pd = pairMap[`${j}-${i}`];
                        if (!pd) return <td key={j} className="empty"></td>;
                        return (
                          <td key={j} style={{ backgroundColor: scoreToColor(pd.scaledScore) }}>
                            <div className="cell-score">{Math.round(pd.scaledScore)}</div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="gradient-legend">
              <span>0</span>
              <div className="gradient-legend-bar" />
              <span>100</span>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="leaderboard-section">
            <h2>Top 10 Leaderboard</h2>
            <ol className="leaderboard-list">
              {result.leaderboard.map((entry, idx) => (
                <li key={idx} className="leaderboard-item">
                  <span className="leaderboard-rank">#{idx + 1}</span>
                  <span className="leaderboard-score">{entry.score}</span>
                  <span className="leaderboard-words">{entry.words.join(', ')}</span>
                </li>
              ))}
            </ol>
          </div>

          <button className="play-again-btn" onClick={handleReset}>
            Play Again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main>
      <h1>Divergent Association Task</h1>
      <p className="subtitle">
        Enter 7 unrelated nouns. The more semantically distant they are, the higher your score.
      </p>

      <form className="input-section" onSubmit={handleSubmit}>
        <div className="input-grid">
          {words.map((word, i) => (
            <div className="input-row" key={i}>
              <label htmlFor={`word-${i}`}>{i + 1}.</label>
              <input
                id={`word-${i}`}
                type="text"
                value={word}
                onChange={(e) => handleChange(i, e.target.value)}
                placeholder={`Word ${i + 1}`}
                className={invalidFields.includes(i) ? 'invalid' : ''}
                autoComplete="off"
                spellCheck="false"
              />
            </div>
          ))}
        </div>

        {error && <p className="error-msg">{error}</p>}

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Scoring…' : 'Score My Words'}
        </button>
      </form>

      {loading && <p className="loading-msg">Fetching embeddings and computing distances…</p>}
    </main>
  );
}
