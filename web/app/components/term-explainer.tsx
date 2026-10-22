"use client";

import { useRef, useState } from "react";
import { ApiError, explainTerm, fetchQuiz, gradeQuiz, type Explanation, type GradeResult, type Quiz as QuizData } from "../lib/api";
import { exitThen, gsap, prefersReducedMotion, revealChildren, useGSAP } from "../lib/motion";
import { recordResult, useProgress } from "../lib/progress";
import Quiz from "./quiz";
import Result from "./result";
import SearchBar from "./search-bar";
import TermCard, { Label, type QuizStatus } from "./term-card";

type Stage = "home" | "card" | "quiz" | "result";

const STARTERS = ["RAG", "Embedding", "Fine-Tuning", "Hallucination", "Transformer", "AI Agent", "LoRA", "Tokenization"];
const STEPS = [
  { n: "01", title: "One line", text: "The term in a single, jargon-free sentence." },
  { n: "02", title: "Mental model", text: "An everyday analogy, plus a real product that uses it." },
  { n: "03", title: "Prove it", text: "Three questions decide if you learned it or need a review." },
];

const errorMessage = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong. Please try again.");

export default function TermExplainer() {
  const [stage, setStage] = useState<Stage>("home");
  const [query, setQuery] = useState("");
  const [card, setCard] = useState<Explanation | null>(null);
  const [cardError, setCardError] = useState("");
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [quizStatus, setQuizStatus] = useState<QuizStatus>("loading");
  const [result, setResult] = useState<GradeResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [toast, setToast] = useState("");

  const stageRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const quizReq = useRef(0);
  const progress = useProgress();

  // Every time the screen changes, fade the new screen's pieces in.
  const stageKey = `${stage}-${card?.term ?? ""}-${attempt}-${loading}`;
  useGSAP(
    () => {
      gsap.set(stageRef.current, { autoAlpha: 1, x: 0, y: 0 });
      revealChildren(stageRef.current, { stagger: stage === "home" ? 0.09 : 0.07, delay: stage === "home" ? 0.1 : 0 });
      if (stage === "home") {
        if (prefersReducedMotion()) gsap.set(".hero-word", { autoAlpha: 1 });
        else
          gsap.fromTo(
            ".hero-word",
            { yPercent: 110, autoAlpha: 0 },
            { yPercent: 0, autoAlpha: 1, duration: 1, stagger: 0.06, ease: "expo.out", delay: 0.15 },
          );
      }
    },
    { dependencies: [stageKey], scope: stageRef },
  );

  // Animate the current screen out, then switch; each new screen starts at the top.
  const go = (next: () => void) =>
    exitThen(stageRef.current, () => {
      window.scrollTo({ top: 0, behavior: "instant" });
      next();
    });

  function loadQuiz(quizId: string) {
    const req = ++quizReq.current;
    setQuiz(null);
    setQuizStatus("loading");
    fetchQuiz(quizId)
      .then((q) => req === quizReq.current && (setQuiz(q), setQuizStatus("ready")))
      .catch(() => req === quizReq.current && setQuizStatus("error"));
  }

  async function lookup(raw: string) {
    const q = raw.trim();
    if (!q) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setQuery(q);
    setToast("");

    let arrived = false;
    const request = explainTerm(q, controller.signal).then((d) => ((arrived = true), d));
    request.catch(() => {}); // handled below, after the exit animation

    await new Promise<void>((resolve) => go(resolve));
    if (controller.signal.aborted) return;
    setStage("card");
    setCardError("");
    if (!arrived) {
      setCard(null);
      setLoading(true); // show the skeleton only if we're actually waiting
    }
    try {
      const data = await request;
      if (data.quiz_id) loadQuiz(data.quiz_id); // the quiz builds while the learner reads
      setCard(data);
    } catch (e) {
      if (controller.signal.aborted) return;
      setCardError(errorMessage(e));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  async function submit(answers: number[]) {
    if (!quiz) return;
    setSubmitting(true);
    try {
      const graded = await gradeQuiz(quiz.quiz_id, answers);
      recordResult(graded.term, graded.verdict);
      go(() => {
        setResult(graded);
        setStage("result");
      });
    } catch (e) {
      setToast(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function retake() {
    if (!card) return;
    // A fresh session reshuffles the options so the retake isn't just muscle memory.
    try {
      const fresh = await explainTerm(card.term);
      setCard(fresh);
      if (fresh.quiz_id) {
        const q = await fetchQuiz(fresh.quiz_id);
        setQuiz(q);
        setQuizStatus("ready");
      }
    } catch {
      /* fall back to retaking the same session */
    }
    go(() => {
      setAttempt((a) => a + 1);
      setStage("quiz");
    });
  }

  function home() {
    abortRef.current?.abort();
    go(() => {
      setStage("home");
      setCard(null);
      setQuery("");
      setResult(null);
      setLoading(false);
    });
  }

  const learned = Object.entries(progress).sort((a, b) => b[1].at - a[1].at);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-20 sm:px-6">
      <nav className="flex items-center justify-between py-6">
        <button onClick={home} className="flex items-center gap-2.5" aria-label="TermSnap home">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink font-serif text-lg text-paper">T</span>
          <span className="font-medium tracking-tight">TermSnap</span>
        </button>
        {learned.length > 0 && (
          <span className="font-mono text-xs text-muted">
            {learned.filter(([, p]) => p.verdict !== "needs_review").length} learned ·{" "}
            {learned.filter(([, p]) => p.verdict === "mastered").length} mastered
          </span>
        )}
      </nav>

      {stage !== "home" && (
        <div className="sticky top-3 z-30 mb-10">
          <SearchBar value={query} loading={loading} onChange={setQuery} onSubmit={lookup} />
        </div>
      )}

      <div ref={stageRef} key={stage === "home" ? "home" : "stage"} className="flex flex-col">
        {stage === "home" && (
          <div className="flex flex-col gap-10 pt-10 sm:pt-20">
            <div className="flex flex-col gap-5">
              <p data-animate className="reveal font-mono text-xs uppercase tracking-[0.25em] text-accent">
                AI glossary · 300+ terms
              </p>
              <h1 className="font-serif text-[3.25rem] leading-[0.95] tracking-tight sm:text-7xl">
                {["Understand", "any", "AI", "term"].map((w) => (
                  <span key={w} className="inline-block overflow-hidden pb-1 align-bottom">
                    <span className="hero-word reveal inline-block">{w}&nbsp;</span>
                  </span>
                ))}
                <br />
                <span className="inline-block overflow-hidden pb-2 align-bottom">
                  <em className="hero-word reveal inline-block text-accent">in one line.</em>
                </span>
              </h1>
              <p data-animate className="reveal max-w-xl text-lg text-muted">
                A one-line answer, a mental model that makes it click, a real-world example, and a quick
                quiz that tells you whether it actually stuck.
              </p>
            </div>

            <div data-animate className="reveal relative z-20">
              <SearchBar value={query} loading={loading} onChange={setQuery} onSubmit={lookup} />
            </div>

            <div data-animate className="reveal flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm text-muted">Try</span>
              {STARTERS.map((t) => (
                <button key={t} onClick={() => lookup(t)} className={chip}>
                  {t}
                </button>
              ))}
            </div>

            {learned.length > 0 && (
              <div data-animate className="reveal flex flex-col gap-3">
                <Label>Your progress</Label>
                <div className="flex flex-wrap gap-2">
                  {learned.slice(0, 12).map(([term, p]) => (
                    <button key={term} onClick={() => lookup(term)} className={`${chip} inline-flex items-center gap-2`}>
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: { mastered: "var(--good)", learned: "var(--accent)", needs_review: "var(--warn)" }[p.verdict] }}
                      />
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <ol className="grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} data-animate className="reveal flex flex-col gap-2 bg-surface/80 p-6 backdrop-blur">
                  <span className="font-mono text-xs text-accent">{s.n}</span>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-sm leading-relaxed text-muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {stage === "card" && cardError && (
          <div data-animate role="alert" className="reveal flex flex-col items-start gap-4 rounded-3xl border border-bad/30 bg-bad-soft p-6">
            <p className="text-bad">{cardError}</p>
            <button onClick={() => lookup(query)} className={chip}>Try again</button>
          </div>
        )}

        {stage === "card" && !cardError && (loading || !card) && <CardSkeleton />}

        {stage === "card" && !loading && card && !card.is_ai_term && (
          <div data-animate className="reveal flex flex-col gap-5 rounded-3xl border border-line bg-surface p-8">
            <p className="font-serif text-3xl leading-tight">{card.one_liner}</p>
            {card.suggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted">Did you mean</span>
                {card.suggestions.map((s) => (
                  <button key={s} onClick={() => lookup(s)} className={chip}>{s}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {stage === "card" && !loading && card?.is_ai_term && (
          <TermCard
            card={card}
            quizStatus={quizStatus}
            onStartQuiz={() => go(() => setStage("quiz"))}
            onRetryQuiz={() => card.quiz_id && loadQuiz(card.quiz_id)}
          />
        )}

        {stage === "quiz" && quiz && (
          <Quiz
            key={`${quiz.quiz_id}-${attempt}`}
            quiz={quiz}
            submitting={submitting}
            onExit={() => go(() => setStage("card"))}
            onSubmit={submit}
          />
        )}

        {stage === "result" && result && (
          <Result
            result={result}
            onRetake={retake}
            onReview={() => go(() => setStage("card"))}
            onNew={home}
          />
        )}
      </div>

      {toast && (
        <div role="alert" className="fixed inset-x-4 bottom-6 z-50 mx-auto flex max-w-md items-center justify-between gap-4 rounded-2xl border border-bad/30 bg-surface px-5 py-4 text-sm shadow-2xl">
          <span className="text-bad">{toast}</span>
          <button onClick={() => setToast("")} className="text-muted hover:text-ink" aria-label="Dismiss">✕</button>
        </div>
      )}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading explanation">
      <div data-animate className="reveal shimmer h-6 w-32 rounded-full" />
      <div data-animate className="reveal shimmer h-14 w-2/3 rounded-2xl" />
      <div data-animate className="reveal shimmer h-32 rounded-3xl" />
      <div className="grid gap-5 sm:grid-cols-2">
        <div data-animate className="reveal shimmer h-36 rounded-3xl" />
        <div data-animate className="reveal shimmer h-36 rounded-3xl" />
      </div>
    </div>
  );
}

const chip =
  "rounded-full border border-line bg-surface/70 px-3.5 py-1.5 text-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-accent/50 hover:text-accent";
