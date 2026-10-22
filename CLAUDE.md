# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

TermSnap is an AI-term explainer for students. Two independent apps:
- `api/`: FastAPI + LangChain agent (Python 3.13, managed with `uv`)
- `web/`: Next.js 16 / React 19 / Tailwind v4 front end

## Commands

```bash
# API (http://localhost:8000). Needs api/.env (copy .env.example; set TERMSNAP_LLM_T1/T2 + keys)
cd api
uv run fastapi dev app/main.py
uv run python -m app.cli                      # terminal version of the agent
uv run pytest                                 # offline; the LLM is faked
uv run pytest tests/test_api.py::test_find_term -q   # single test
uv run python -m app.export_glossary          # regenerate the web glossary after editing glossary.json

# Web (http://localhost:3000)
cd web
npm run dev
npm run build
npx eslint app                                # `npm run lint` also works
npx tsc --noEmit -p .
```

When chaining lint with other commands, don't pipe it through `tail`/`head`; the pipe hides eslint's non-zero exit code.

## Next.js version warning (from web/AGENTS.md)

This Next.js version has breaking changes from what you may know. Before writing Next.js code, read the relevant guide in `web/node_modules/next/dist/docs/` and follow deprecation notices. `next.config.ts` enables `cacheComponents`, `partialPrefetching` and `experimental.agentFeedback`. `next dev` rewrites `web/AGENTS.md`; commit that file as-is.

## Architecture

### Glossary: one merged source of truth
- `api/data/ai_glossary.json`: 303 reviewed entries (`id`, `term`, `aliases`, `category`, `definition`, optional `mental_model`, `example`, `quiz`).
- `glossary.json` (repo root): flat `{"term": "definition"}` student glossary.
- `api/app/glossary.py` `load_glossary()` merges them (332 terms). An existing entry wins and the student name becomes an alias. Unknown keys become definition-only entries (`source: "student-glossary"`). `SAME_AS` maps student names onto existing ids. `DISTINCT` forces a separate entry where the main file had wrongly aliased it (LLMOps, model drift, open-source model). Lookup normalizes punctuation and strips simple plurals.
- `api/app/export_glossary.py` writes `web/app/lib/demo/glossary.generated.json` (keyed by the student glossary, enriched with mental model/example/quiz when the names match). The web app never reads the root JSON directly; re-run the export after changing either glossary.

### API request flow (`api/app/`)
- `agent.py` picks the card path: an enriched glossary entry is served with no LLM call; a definition-only entry gets one grounded structured call; an unknown query goes to a LangChain `create_agent` with a `lookup_term` tool (spelling fixes, off-topic detection). Models come from `"provider:model"` strings (`ollama:`, `google_genai:`). The fallback model is wired in via `ModelFallbackMiddleware`.
- `main.py` starts quiz generation in the background as soon as the card is ready. Identical in-flight requests share one task (`_dedupe`). Cards/quizzes are cached in SQLite (`store.py`, `api/data/termsnap.db`) under keys prefixed with `config.CACHE_VERSION`. Bump it when prompts or schemas change.
- Answer keys stay server-side. The quiz endpoint returns shuffled options per session, and grading happens on `POST /api/quiz/{id}/grade`.
- Tests monkeypatch `main.generate_card` / `main.generate_quiz` and `get_models`, so they never call a model.

### Web app (`web/app/`)
- `page.tsx` renders `components/demo/app.tsx`: a fully client-side demo with simulated AI (no API calls). The older API-backed components (`components/*.tsx` outside `demo/`, `lib/api.ts`, `NEXT_PUBLIC_API_URL`) are no longer used by the page.
- State: one `useReducer` store in `lib/demo/store.tsx` (views, XP/level, credits, streak, badges, review queue, deck, drafts, toasts). Badge unlocks are checked inside the reducer (`checkBadges`). XP is earned only from learning actions; credits are spent separately (AI drafts, uncached audience versions).
- Data: `lib/demo/data.ts` has 12 hand-written core terms (4 layers × 3 audiences each) plus terms built from `glossary.generated.json`. Those are flagged `basic: true`: one audience level, only the layers that exist, auto-generated explain-back keywords and multiple-choice question, and concept-map prerequisites taken from terms their definition mentions. `CORE_FOR_KEY` maps glossary keys onto core terms.
- `lib/demo/search.ts`: fuzzy search, "did you mean" (Levenshtein), and `findTermsInText` for paste highlighting (longest label wins, plurals allowed, a few generic words excluded).
- `lib/demo/hooks.ts` `useStream` simulates token streaming (retrieving → writing → done/stopped) and is skipped under `prefers-reduced-motion`.
- Styling: claymorphism theme tokens in `globals.css`. Light and dark values are defined for `prefers-color-scheme` and for `[data-theme]` (set by the header theme toggle). They are exposed to Tailwind via `@theme inline` (`bg-card`, `text-primary-text`, `bg-ok-bg`, …). Fonts are Bricolage Grotesque (`font-display`) and Plus Jakarta Sans.
