"""Offline tests: the LLM is replaced with fakes, so these run without any model."""

import pytest
from fastapi.testclient import TestClient

from app import main
from app.glossary import find_term, suggest_terms
from app.schemas import QuizQuestion, TermCard

FAKE_QUIZ = [
    QuizQuestion(question=f"Q{i}?", options=["right", "wrong a", "wrong b", "wrong c"], answer_index=0, explanation="Because.")
    for i in range(3)
]


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(main.config, "DB_PATH", tmp_path / "test.db")
    monkeypatch.setattr(main, "get_models", lambda: None)

    async def fake_card(query, entry):
        if entry:
            return TermCard(is_ai_term=True, term=entry["term"], one_liner="x", mental_model="m", real_world_example="e"), "glossary", []
        return TermCard(is_ai_term=False, term=query, one_liner="Not an AI term."), "llm", ["Transformer"]

    async def fake_quiz(card, entry):
        return FAKE_QUIZ

    monkeypatch.setattr(main, "generate_card", fake_card)
    monkeypatch.setattr(main, "generate_quiz", fake_quiz)
    with TestClient(main.app) as c:
        yield c


@pytest.mark.parametrize("query,expected", [
    ("RAG", "Retrieval-Augmented Generation (RAG)"),
    ("what is fine tuning", "Fine-Tuning"),
    ("Embeddings", "Embedding"),
    ("LLMs", "Large Language Model (LLM)"),
])
def test_find_term(query, expected):
    assert find_term(query)["term"] == expected


def test_suggestions_for_typo():
    assert "Transformer" in suggest_terms("transfomer")


def answer_key(quiz):
    return [q["options"].index("right") for q in quiz["questions"]]


def test_full_flow_mastered(client):
    card = client.post("/api/explain", json={"query": "RAG"}).json()
    assert card["is_ai_term"] and card["quiz_id"]
    quiz = client.get(f"/api/quiz/{card['quiz_id']}").json()
    assert len(quiz["questions"]) == 3 and "answer_index" not in quiz["questions"][0]
    result = client.post(f"/api/quiz/{card['quiz_id']}/grade", json={"answers": answer_key(quiz)}).json()
    assert result["score"] == 3 and result["verdict"] == "mastered"


def test_learned_and_needs_review(client):
    for wrong, verdict in [(1, "learned"), (2, "needs_review")]:
        card = client.post("/api/explain", json={"query": "RAG"}).json()
        quiz = client.get(f"/api/quiz/{card['quiz_id']}").json()
        answers = answer_key(quiz)
        for i in range(wrong):
            answers[i] = (answers[i] + 1) % 4
        assert client.post(f"/api/quiz/{card['quiz_id']}/grade", json={"answers": answers}).json()["verdict"] == verdict


def test_answer_key_is_stable_per_session(client):
    card = client.post("/api/explain", json={"query": "RAG"}).json()
    first = client.get(f"/api/quiz/{card['quiz_id']}").json()
    assert client.get(f"/api/quiz/{card['quiz_id']}").json() == first


def test_off_topic_has_no_quiz(client):
    card = client.post("/api/explain", json={"query": "pizza"}).json()
    assert card["is_ai_term"] is False and card["quiz_id"] is None and card["suggestions"]


def test_errors(client):
    assert client.post("/api/explain", json={"query": "  ?? "}).status_code == 400
    assert client.post("/api/quiz/missing/grade", json={"answers": [0]}).status_code == 404
    card = client.post("/api/explain", json={"query": "RAG"}).json()
    client.get(f"/api/quiz/{card['quiz_id']}")
    assert client.post(f"/api/quiz/{card['quiz_id']}/grade", json={"answers": [0]}).status_code == 422


# ---------- student glossary (repo-root glossary.json) ----------

@pytest.mark.parametrize("query,expected_id", [
    ("hyperscaler", "hyperscaler"),        # new term, definition only
    ("HCI", "hci"),                        # acronym of a new term
    ("vision transformer", "vision-transformer"),
    ("ViT", "vision-transformer"),
    ("LLMOps", "llmops"),                  # separate from MLOps in the student glossary
    ("model drift", "model-drift"),        # separate from data drift
    ("open-source model", "open-source-model"),
    ("k-NN", "knn"),                       # same concept, mapped to the existing entry
    ("few-shot learning", "few-shot"),
    ("foundation models", "foundation-model"),  # plural of an existing term: no duplicate
])
def test_student_glossary_terms(query, expected_id):
    assert find_term(query)["id"] == expected_id


def test_student_glossary_keeps_existing_entries():
    from app.glossary import load_glossary
    terms, _ = load_glossary()
    ids = [t["id"] for t in terms]
    assert len(ids) == len(set(ids))
    assert find_term("MLOps")["id"] == "mlops"
    assert find_term("RAG")["term"] == "Retrieval-Augmented Generation (RAG)"
    new = find_term("hyperscaler")
    assert new["definition"].startswith("A huge cloud company")
    assert new["category"] == "Infrastructure & Hardware"


def test_export_covers_every_student_term():
    from app.export_glossary import export
    from app.glossary import load_student_glossary
    items = export()
    assert len(items) == len(load_student_glossary())
    assert len({i["id"] for i in items}) == len(items)
