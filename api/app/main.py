"""TermSnap API: explain an AI term, then quiz the learner on it.

Run:  uv run fastapi dev app/main.py
"""

import asyncio
import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from . import config
from .agent import generate_card, generate_quiz, get_models, shuffle_options
from .glossary import find_term, load_glossary, normalize
from .schemas import (
    PASS_SCORE,
    ExplainRequest,
    ExplainResponse,
    GradeRequest,
    GradeResponse,
    PublicQuestion,
    QuestionResult,
    QuizQuestion,
    QuizResponse,
    TermCard,
)
from .store import Store

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("termsnap.api")

store: Store
# In-flight generations, so 10 people asking "RAG" at once trigger one LLM call, not 10.
_card_tasks: dict[str, asyncio.Task] = {}
_quiz_tasks: dict[str, asyncio.Task] = {}


@asynccontextmanager
async def lifespan(_: FastAPI):
    global store
    store = Store(config.DB_PATH)
    load_glossary()
    get_models()  # build model clients once, not on the first request
    log.info("TermSnap ready (primary=%s, fallback=%s)", config.PRIMARY_MODEL, config.FALLBACK_MODEL or "none")
    yield


app = FastAPI(title="TermSnap API", version="0.3.0", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def timing(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    ms = (time.perf_counter() - start) * 1000
    response.headers["Server-Timing"] = f"app;dur={ms:.0f}"
    log.info("%s %s -> %s in %.0fms", request.method, request.url.path, response.status_code, ms)
    return response


# ---------- helpers ----------

def _cache_key(query: str, entry: dict | None) -> str:
    return f"{config.CACHE_VERSION}:{entry['id'] if entry else 'q:' + normalize(query)}"


def _dedupe(tasks: dict[str, asyncio.Task], key: str, factory) -> asyncio.Task:
    task = tasks.get(key)
    if task is None:
        task = asyncio.create_task(factory())
        tasks[key] = task
        task.add_done_callback(lambda _t: tasks.pop(key, None))
    return task


def _start_quiz(key: str, card: TermCard) -> asyncio.Task | None:
    """Kick off quiz generation in the background unless it's already cached or running."""
    if store.get_quiz(key) is not None:
        return None

    async def build():
        questions = await generate_quiz(card, find_term(card.term))
        store.put_quiz(key, questions)
        return questions

    task = _dedupe(_quiz_tasks, key, build)
    # Swallow the error here so an unread background failure isn't logged as "never retrieved".
    task.add_done_callback(lambda t: t.cancelled() or t.exception())
    return task


async def _quiz_for(key: str) -> list[QuizQuestion]:
    if (questions := store.get_quiz(key)) is not None:
        return questions
    cached = store.get_card(key)
    if cached is None:
        raise HTTPException(404, "Quiz not found. Look up the term again.")
    task = _start_quiz(key, cached[0])
    if task is None:  # finished between the two checks
        return store.get_quiz(key) or []
    return await asyncio.shield(task)


# ---------- routes ----------

@app.get("/api/health")
def health():
    return {"status": "ok", "glossary_terms": len(load_glossary()[0]), "model": config.PRIMARY_MODEL}


@app.get("/api/terms")
def list_terms():
    """Term names + aliases for autocomplete."""
    terms, _ = load_glossary()
    return [{"id": t["id"], "term": t["term"], "aliases": t.get("aliases", []), "category": t["category"]} for t in terms]


@app.post("/api/explain", response_model=ExplainResponse)
async def explain(req: ExplainRequest):
    query = req.query.strip()
    if not normalize(query):
        raise HTTPException(400, "Please enter an AI term.")
    entry = find_term(query)
    key = _cache_key(query, entry)

    suggestions: list[str] = []
    if cached := store.get_card(key):
        card, source = cached
    else:
        try:
            card, source, suggestions = await asyncio.shield(
                _dedupe(_card_tasks, key, lambda: generate_card(query, entry))
            )
        except TimeoutError:
            raise HTTPException(504, "The AI model took too long. Please try again.")
        except Exception as exc:
            log.exception("Card generation failed for %r", query)
            raise HTTPException(503, "The AI model is unavailable right now. Please try again shortly.") from exc
        if card.is_ai_term:
            store.put_card(key, card, source)

    quiz_id = None
    if card.is_ai_term:
        quiz_id = uuid.uuid4().hex
        store.create_session(quiz_id, key, card.term)
        _start_quiz(key, card)  # generate while the learner reads the card

    return ExplainResponse(**card.model_dump(), source=source, quiz_id=quiz_id, suggestions=suggestions)


@app.get("/api/quiz/{quiz_id}", response_model=QuizResponse)
async def get_quiz(quiz_id: str):
    session = store.get_session(quiz_id)
    if session is None:
        raise HTTPException(404, "Quiz expired. Look up the term again to get a new quiz.")
    key, term, questions = session

    if questions is None:
        try:
            base = await _quiz_for(key)
        except HTTPException:
            raise
        except TimeoutError:
            raise HTTPException(504, "The quiz took too long to generate. Please try again.")
        except Exception as exc:
            log.exception("Quiz generation failed for %s", term)
            raise HTTPException(503, "Couldn't generate the quiz right now. Please try again.") from exc
        # Each attempt gets its own option order; the stored copy is the answer key for grading.
        store.set_session_questions(quiz_id, [shuffle_options(q) for q in base])
        questions = store.get_session(quiz_id)[2]

    return QuizResponse(
        quiz_id=quiz_id,
        term=term,
        questions=[PublicQuestion(question=q.question, options=q.options) for q in questions],
    )


@app.post("/api/quiz/{quiz_id}/grade", response_model=GradeResponse)
def grade_quiz(quiz_id: str, req: GradeRequest):
    session = store.get_session(quiz_id)
    if session is None or session[2] is None:
        raise HTTPException(404, "Quiz expired. Look up the term again to get a new quiz.")
    _, term, questions = session
    if len(req.answers) != len(questions):
        raise HTTPException(422, f"Expected {len(questions)} answers, got {len(req.answers)}.")

    results = [
        QuestionResult(
            question=q.question,
            options=q.options,
            your_answer=a,
            correct_answer=q.answer_index,
            is_correct=a == q.answer_index,
            explanation=q.explanation,
        )
        for q, a in zip(questions, req.answers)
    ]
    score, total = sum(r.is_correct for r in results), len(results)
    pass_mark = min(PASS_SCORE, total)

    if score == total:
        verdict, message = "mastered", f"Perfect score. You've mastered {term}."
    elif score >= pass_mark:
        verdict, message = "learned", f"You've learned {term}. Check the one you missed below."
    else:
        verdict, message = "needs_review", f"Not quite yet. Revisit the mental model for {term} and try again."

    return GradeResponse(
        term=term, score=score, total=total, passed=score >= pass_mark,
        verdict=verdict, message=message, results=results,
    )
