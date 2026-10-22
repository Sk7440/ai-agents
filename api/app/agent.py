"""AI Term Explainer Agent.

Card (shown first, fast):
  1. Glossary term with mental model + example  -> served instantly, no LLM call.
  2. Glossary term with definition only          -> one grounded LLM call.
  3. Unknown query                               -> tool-using agent (lookup, spelling fixes, off-topic check).
Quiz (generated in the background while the learner reads the card):
  One structured LLM call; the glossary's own question is reused as Q1 when one exists.
"""

import asyncio
import json
import logging
import os
import random

from langchain.agents import create_agent
from langchain.agents.middleware import ModelFallbackMiddleware
from langchain.agents.structured_output import ToolStrategy
from langchain.chat_models import init_chat_model
from langchain.tools import tool

from . import config
from .glossary import find_term, is_enriched, suggest_terms
from .schemas import QUIZ_LENGTH, QuizQuestion, QuizSet, TermCard

log = logging.getLogger("termsnap.agent")


# ---------- Models ----------

def _make_model(spec: str, key: str):
    """Build a chat model from 'provider:model', passing its API key when one is set."""
    kwargs: dict = {"temperature": 0.3}
    if spec.startswith("google_genai:") and key:
        kwargs["api_key"] = key
    elif spec.startswith("ollama:") and key:
        os.environ.setdefault("OLLAMA_API_KEY", key)
    return init_chat_model(spec, **kwargs)


class Models:
    """Created once at startup and reused by every request."""

    def __init__(self):
        self.primary = _make_model(config.PRIMARY_MODEL, config.PRIMARY_KEY)
        self.fallback = _make_model(config.FALLBACK_MODEL, config.FALLBACK_KEY) if config.FALLBACK_MODEL else None
        self.card = self._structured(TermCard)
        self.quiz = self._structured(QuizSet)
        self.agent = create_agent(
            model=self.primary,
            tools=[lookup_term],
            system_prompt=AGENT_PROMPT,
            response_format=ToolStrategy(TermCard),
            middleware=[ModelFallbackMiddleware(self.fallback)] if self.fallback else [],
        )

    def _structured(self, schema):
        # Tool calling is the most reliable structured-output mode across Ollama and Gemini.
        runnable = self.primary.with_structured_output(schema, method="function_calling").with_retry(stop_after_attempt=2)
        if self.fallback:
            runnable = runnable.with_fallbacks([self.fallback.with_structured_output(schema, method="function_calling")])
        return runnable


_models: Models | None = None


def get_models() -> Models:
    global _models
    if _models is None:
        _models = Models()
    return _models


# ---------- Tool ----------

@tool
def lookup_term(term: str) -> str:
    """Look up an AI term in the TermSnap glossary. Call this first with the term the user asked about.

    Returns the glossary entry as JSON, or {"found": false, "suggestions": [...]} when it isn't in the glossary.
    """
    entry = find_term(term)
    if entry is None:
        return json.dumps({"found": False, "suggestions": suggest_terms(term)})
    return json.dumps({"found": True, **entry})


# ---------- Prompts ----------

CARD_RULES = """CARD RULES
- one_liner: exactly ONE sentence, at most ~25 words, plain English, no unexplained jargon.
- mental_model: an everyday analogy (kitchen, library, school, sports...) that makes the idea click. 1-2 sentences.
- real_world_example: a concrete, real product or situation (e.g. ChatGPT, Netflix recommendations, Gmail spam filter). 1-2 sentences.
- Be accurate. Never invent facts about real products."""

AGENT_PROMPT = f"""You are the AI Term Explainer Agent for TermSnap, which teaches AI terms fast.

WORKFLOW
1. Work out which AI term the user means (e.g. "whats rag" -> "RAG", "transfomer" -> "Transformer").
2. Call `lookup_term`. If not found but a suggestion clearly matches the user's intent, look that up instead.
3. Return the learning card. Use the glossary name/category/definition when found.

{CARD_RULES}

OFF-TOPIC
If the query is not an AI / ML / data-science term, set is_ai_term=false, write a short polite one_liner saying
TermSnap only explains AI terms, and leave mental_model and real_world_example empty."""

GROUNDED_CARD_PROMPT = f"""You write TermSnap learning cards for AI terms. Stay faithful to the glossary definition given.

{CARD_RULES}
- Set is_ai_term=true and keep the given term name and category."""

QUIZ_PROMPT = f"""You write short quizzes that check whether a learner truly understood an AI term.

Write exactly {QUIZ_LENGTH} multiple-choice questions with 4 options each:
- Q1 tests the core definition.
- Q2 tests understanding of WHY/HOW it works (use the mental model; don't just ask to repeat its wording).
- Q3 is a short realistic scenario where the learner must recognise or apply the term.
Rules:
- Exactly one correct option. Distractors are plausible misconceptions or nearby terms, never silly.
- Options are short and similar in length; avoid "all/none of the above".
- explanation: one sentence on why the correct answer is right."""


# ---------- Card ----------

def card_from_glossary(entry: dict) -> TermCard:
    return TermCard(
        is_ai_term=True,
        term=entry["term"],
        category=entry.get("category", ""),
        one_liner=entry["definition"],
        mental_model=entry["mental_model"],
        real_world_example=entry["example"],
    )


async def _with_timeout(coro):
    return await asyncio.wait_for(coro, timeout=config.LLM_TIMEOUT)


async def generate_card(query: str, entry: dict | None) -> tuple[TermCard, str, list[str]]:
    """Returns (card, source, suggestions)."""
    if entry and is_enriched(entry):
        return card_from_glossary(entry), "glossary", []

    models = get_models()
    if entry:
        prompt = (
            f"Term: {entry['term']}\nCategory: {entry['category']}\n"
            f"Aliases: {', '.join(entry.get('aliases', [])) or 'none'}\nGlossary definition: {entry['definition']}"
        )
        card = await _with_timeout(
            models.card.ainvoke([{"role": "system", "content": GROUNDED_CARD_PROMPT}, {"role": "user", "content": prompt}])
        )
        card.is_ai_term, card.term, card.category = True, entry["term"], entry["category"]
        return card, "glossary+llm", []

    result = await _with_timeout(models.agent.ainvoke({"messages": [{"role": "user", "content": query}]}))
    card: TermCard = result["structured_response"]
    if not card.is_ai_term:
        card.mental_model = card.real_world_example = ""
        return card, "llm", suggest_terms(query)
    return card, ("glossary+llm" if find_term(card.term) else "llm"), []


# ---------- Quiz ----------

async def generate_quiz(card: TermCard, entry: dict | None) -> list[QuizQuestion]:
    glossary_q = QuizQuestion(**entry["quiz"]) if entry and entry.get("quiz") else None
    prompt = (
        f"Term: {card.term}\nDefinition: {card.one_liner}\n"
        f"Mental model: {card.mental_model}\nReal-world example: {card.real_world_example}"
    )
    try:
        quiz: QuizSet = await _with_timeout(
            get_models().quiz.ainvoke([{"role": "system", "content": QUIZ_PROMPT}, {"role": "user", "content": prompt}])
        )
        questions = quiz.questions
    except Exception:
        if glossary_q is None:
            raise
        log.warning("Quiz LLM failed for %s; using the glossary question only", card.term, exc_info=True)
        return [glossary_q]
    if glossary_q:
        questions[0] = glossary_q  # reviewed, hand-written question beats a generated one
    return questions


def shuffle_options(q: QuizQuestion) -> QuizQuestion:
    """LLMs tend to put the answer first; shuffle so position gives nothing away."""
    order = random.sample(range(len(q.options)), len(q.options))
    return QuizQuestion(
        question=q.question,
        options=[q.options[i] for i in order],
        answer_index=order.index(q.answer_index),
        explanation=q.explanation,
    )
