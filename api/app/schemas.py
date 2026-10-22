from typing import Literal

from pydantic import BaseModel, Field, model_validator

QUIZ_LENGTH = 3
PASS_SCORE = 2  # out of QUIZ_LENGTH: 2/3 = learned, 3/3 = mastered


# ---------- Structured output the LLM must return ----------

class TermCard(BaseModel):
    """A learning card for one AI term."""

    is_ai_term: bool = Field(description="False if the query is not an AI/ML/data term.")
    term: str = Field(description="Canonical name of the term, e.g. 'Retrieval-Augmented Generation (RAG)'.")
    category: str = Field(default="", description="Glossary category, or a best-guess category.")
    one_liner: str = Field(description="ONE sentence, max ~25 words, plain-English definition.")
    mental_model: str = Field(default="", description="An everyday analogy that makes the idea click (1-2 sentences).")
    real_world_example: str = Field(default="", description="A concrete, real product or situation using it (1-2 sentences).")


class QuizQuestion(BaseModel):
    question: str = Field(description="One clear multiple-choice question.")
    options: list[str] = Field(min_length=4, max_length=4, description="Exactly 4 short answer options.")
    answer_index: int = Field(ge=0, le=3, description="Index (0-3) of the single correct option.")
    explanation: str = Field(description="One sentence on why the correct option is right.")

    @model_validator(mode="after")
    def distinct_options(self):
        if len({o.strip().lower() for o in self.options}) != len(self.options):
            raise ValueError("options must be distinct")
        return self


class QuizSet(BaseModel):
    questions: list[QuizQuestion] = Field(
        min_length=QUIZ_LENGTH, max_length=QUIZ_LENGTH, description=f"Exactly {QUIZ_LENGTH} questions."
    )


# ---------- API models ----------

Source = Literal["glossary", "glossary+llm", "llm"]


class ExplainRequest(BaseModel):
    query: str = Field(min_length=1, max_length=200)


class ExplainResponse(TermCard):
    source: Source
    quiz_id: str | None = None
    suggestions: list[str] = []


class PublicQuestion(BaseModel):
    """A quiz question without the answer, so the client can't peek."""

    question: str
    options: list[str]


class QuizResponse(BaseModel):
    quiz_id: str
    term: str
    questions: list[PublicQuestion]


class GradeRequest(BaseModel):
    answers: list[int]


class QuestionResult(BaseModel):
    question: str
    options: list[str]
    your_answer: int
    correct_answer: int
    is_correct: bool
    explanation: str


class GradeResponse(BaseModel):
    term: str
    score: int
    total: int
    passed: bool
    verdict: Literal["mastered", "learned", "needs_review"]
    message: str
    results: list[QuestionResult]
