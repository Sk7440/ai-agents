"""Loads the AI glossary and finds terms by name, alias, or close spelling."""

import difflib
import json
import os
import re
from functools import lru_cache
from pathlib import Path

GLOSSARY_PATH = Path(__file__).resolve().parent.parent / "data" / "ai_glossary.json"
# Short, student-friendly glossary at the repo root. Its terms are merged into the main glossary.
STUDENT_GLOSSARY_PATH = Path(
    os.getenv("TERMSNAP_STUDENT_GLOSSARY", Path(__file__).resolve().parents[2] / "glossary.json")
)

# Student-glossary names for concepts the main glossary already covers under another name.
SAME_AS = {
    "few shot learning": "few-shot",
    "zero shot learning": "zero-shot",
    "k nn": "knn",
    "parameter": "parameters",
    "ensemble methods": "ensemble-learning",
    "bias in ai": "algorithmic-bias",
}
# The main glossary lists these as aliases of a neighbour, but the student glossary
# defines them as separate concepts (LLMOps vs MLOps, model drift vs data drift, ...).
DISTINCT = {"llmops", "model drift", "open source model"}

STUDENT_CATEGORIES = {
    "adversarial distillation attack": "Safety & Alignment",
    "ai benchmarks": "Evaluation",
    "ai fluency": "Governance & Policy",
    "ai tech stack": "Infrastructure & Hardware",
    "ai workflow": "Fundamentals",
    "algorithmic monoculture": "Safety & Alignment",
    "artificial hivemind": "Agents & Tools",
    "automation": "Fundamentals",
    "bayesian networks": "Machine Learning",
    "big data": "Data",
    "closed source": "Governance & Policy",
    "contrastive learning": "Machine Learning",
    "data mining": "Data",
    "ethical ai": "Safety & Alignment",
    "human centered ai": "Safety & Alignment",
    "hci": "Fundamentals",
    "hyperscaler": "Infrastructure & Hardware",
    "llmops": "Infrastructure & Hardware",
    "markov chain": "Machine Learning",
    "model drift": "Evaluation",
    "open source": "Governance & Policy",
    "open source model": "Language Models",
    "optimization algorithm": "Machine Learning",
    "predictive analytics": "Data",
    "robotics": "Multimodal & Generative Media",
    "semantic analysis": "Language Models",
    "spatial intelligence": "Multimodal & Generative Media",
    "traditional ai": "Fundamentals",
    "vision transformer": "Deep Learning",
}
SPECIAL_NAMES = {"llmops": "LLMOps", "hci": "HCI", "ai": "AI"}


def normalize(text: str) -> str:
    """Lowercase and strip punctuation so 'Fine-tuning' == 'fine tuning'."""
    text = re.sub(r"[^a-z0-9]+", " ", text.lower())
    return " ".join(text.split())


def _keys_for(entry: dict) -> set[str]:
    term = entry["term"]
    keys = {entry["id"], term, re.sub(r"\s*\(.*?\)", "", term)}  # "Machine Learning (ML)" -> "Machine Learning"
    keys.update(entry.get("aliases", []))
    return {normalize(k) for k in keys if k}


def _title(name: str) -> str:
    """'human-centered ai' -> 'Human-Centered AI'."""
    words = []
    for word in name.split():
        words.append("-".join(SPECIAL_NAMES.get(p, p.capitalize()) for p in word.split("-")))
    return " ".join(words)


def student_entry(key: str, definition: str) -> dict:
    """Turn one glossary.json item into a main-glossary style entry (definition only)."""
    term, aliases = _title(key), []
    # "Human-Computer Interaction - the study of ..." / "ViT - a transformer ..."
    m = re.match(r"^([A-Za-z][\w\-/ ]{1,40}?) - (.+)$", definition)
    if m:
        prefix, definition = m.group(1).strip(), m.group(2).strip()
        if len(prefix) < len(key):  # acronym, e.g. "ViT"
            term = f"{term} ({prefix})"
            aliases.append(prefix)
        else:  # expansion, e.g. "Human-Computer Interaction" for "hci"
            short = key.upper() if len(key) <= 5 else term
            term = f"{prefix} ({short})"
            aliases.append(short)
        definition = definition[0].upper() + definition[1:]
    return {
        "id": re.sub(r"[^a-z0-9]+", "-", key.lower()).strip("-"),
        "term": term,
        "aliases": aliases,
        "category": STUDENT_CATEGORIES.get(normalize(key), "Fundamentals"),
        "definition": definition,
        "source": "student-glossary",
    }


def load_student_glossary() -> dict[str, str]:
    if not STUDENT_GLOSSARY_PATH.exists():
        return {}
    with STUDENT_GLOSSARY_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def _lookup(index: dict[str, dict], key: str) -> dict | None:
    """Exact key, or its singular form ("foundation models" -> "foundation model")."""
    if key in index:
        return index[key]
    if key.endswith("s") and key[:-1] in index:
        return index[key[:-1]]
    return None


@lru_cache(maxsize=1)
def load_glossary() -> tuple[list[dict], dict[str, dict]]:
    with GLOSSARY_PATH.open(encoding="utf-8") as f:
        terms = json.load(f)["terms"]
    index: dict[str, dict] = {}
    for entry in terms:
        for key in _keys_for(entry):
            index.setdefault(key, entry)

    by_id = {t["id"]: t for t in terms}
    for key, definition in load_student_glossary().items():
        nk = normalize(key)
        if nk in SAME_AS:
            target = by_id[SAME_AS[nk]]
            target.setdefault("aliases", []).append(key)
            index.setdefault(nk, target)
        elif nk not in DISTINCT and _lookup(index, nk):
            continue  # already covered, keep the richer reviewed entry
        else:
            entry = student_entry(key, definition)
            terms.append(entry)
            for k in _keys_for(entry):
                index[k] = entry  # overrides an old alias for DISTINCT terms
    return terms, index


def student_match(key: str) -> dict | None:
    """The glossary entry a glossary.json key resolves to."""
    _, index = load_glossary()
    return _lookup(index, normalize(key))


def find_term(query: str) -> dict | None:
    """Exact match on id, term, or alias (after normalizing)."""
    _, index = load_glossary()
    q = normalize(query)
    # Accept phrasings like "what is rag" or "explain tokens".
    q = re.sub(r"^(what is|what are|what s|explain|define|meaning of|tell me about)\s+(an?\s+|the\s+)?", "", q)
    return _lookup(index, q)  # also handles "embeddings" -> "embedding"


def suggest_terms(query: str, limit: int = 5) -> list[str]:
    """Closest glossary terms for a query that didn't match exactly."""
    terms, index = load_glossary()
    matches = difflib.get_close_matches(normalize(query), index.keys(), n=limit * 2, cutoff=0.6)
    seen: list[str] = []
    for m in matches:
        name = index[m]["term"]
        if name not in seen:
            seen.append(name)
    return seen[:limit]


def is_enriched(entry: dict) -> bool:
    return all(entry.get(k) for k in ("mental_model", "example", "quiz"))
