# TermSnap: AI Term Explainer Agent

Ask about any AI term and get:
1. **A one-line answer**
2. **A mental model** (an everyday analogy)
3. **A real-world example**
4. **A 3-question quiz.** 3/3 = mastered, 2/3 = learned, 0-1 = needs review.

The agent (LangChain, in `api/`) looks the term up in the glossary first, so answers stay grounded. Then it writes the card and quiz as structured output. Correct answers stay on the server, so they never reach the browser.

## Glossary

Two sources are merged into one glossary (332 terms):

| File | What it holds |
|---|---|
| `api/data/ai_glossary.json` | 303 reviewed terms; many have a mental model, example and quiz |
| `glossary.json` (repo root) | 105 short, student-friendly definitions (`"term": "definition"`) |

- Terms already in the main glossary keep their richer entry; the student term's name becomes an alias.
- New terms (29, e.g. Hyperscaler, LLMOps, Model drift) are added as definition-only entries.
- A few names map to an existing concept (`k-nn` → KNN, `few-shot learning` → Few-Shot). See `SAME_AS` / `DISTINCT` in `api/app/glossary.py`.

The web demo is built from the same data. After editing `glossary.json`, regenerate it:

```bash
cd api && uv run python -m app.export_glossary   # writes web/app/lib/demo/glossary.generated.json
```

## Run

```bash
# API (FastAPI) on http://localhost:8000
cd api
cp .env.example .env   # set TERMSNAP_LLM_T1 / T2 and their keys
uv run fastapi dev app/main.py

# Terminal version of the agent (optional)
uv run python -m app.cli

# Web (Next.js) on http://localhost:3000
cd web
npm run dev
```

## How it's fast

| Path | When | Card time |
|---|---|---|
| Glossary | Term has a mental model + example in the glossary | instant (no LLM) |
| Glossary + LLM | Term is in the glossary with a definition only | ~1-3s, one grounded call |
| Agent | Unknown query: spelling fixes, off-topic check via the `lookup_term` tool | ~2-5s |

- The quiz is generated **in the background** while the learner reads the card.
- Cards and quizzes are cached in SQLite (`api/data/termsnap.db`), so repeat lookups take milliseconds and survive restarts.
- Identical requests arriving together share one LLM call.
- Primary model falls back to `TERMSNAP_LLM_T2` automatically.

## API

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/explain` | `{ "query": "What is RAG?" }` | one-liner, mental model, example, `quiz_id` |
| GET | `/api/quiz/{quiz_id}` | | 3 questions (no answers; options shuffled per attempt) |
| POST | `/api/quiz/{quiz_id}/grade` | `{ "answers": [0, 2, 1] }` | score, verdict, per-question explanations |
| GET | `/api/terms` | | glossary terms (for autocomplete) |
| GET | `/api/health` | | status |

## Tests

```bash
cd api && uv run pytest    # offline: the LLM is faked
```
