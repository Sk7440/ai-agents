export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Explanation = {
  is_ai_term: boolean;
  term: string;
  category: string;
  one_liner: string;
  mental_model: string;
  real_world_example: string;
  source: "glossary" | "glossary+llm" | "llm";
  quiz_id: string | null;
  suggestions: string[];
};

export type Quiz = {
  quiz_id: string;
  term: string;
  questions: { question: string; options: string[] }[];
};

export type GradeResult = {
  term: string;
  score: number;
  total: number;
  passed: boolean;
  verdict: "mastered" | "learned" | "needs_review";
  message: string;
  results: {
    question: string;
    options: string[];
    your_answer: number;
    correct_answer: number;
    is_correct: boolean;
    explanation: string;
  }[];
};

export type GlossaryTerm = { id: string; term: string; aliases: string[]; category: string };

export class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("Can't reach the TermSnap server. Is the API running?");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const detail = typeof data?.detail === "string" ? data.detail : `Request failed (${res.status})`;
    throw new ApiError(detail);
  }
  return res.json();
}

export const explainTerm = (query: string, signal?: AbortSignal) =>
  request<Explanation>("/api/explain", { method: "POST", body: JSON.stringify({ query }), signal });

export const fetchQuiz = (quizId: string) => request<Quiz>(`/api/quiz/${quizId}`);

export const gradeQuiz = (quizId: string, answers: number[]) =>
  request<GradeResult>(`/api/quiz/${quizId}/grade`, { method: "POST", body: JSON.stringify({ answers }) });

let termsPromise: Promise<GlossaryTerm[]> | null = null;
export const fetchTerms = () => {
  termsPromise ??= request<GlossaryTerm[]>("/api/terms").catch(() => {
    termsPromise = null;
    return [];
  });
  return termsPromise;
};
