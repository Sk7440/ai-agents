"use client";

import { useRef } from "react";
import type { Explanation } from "../lib/api";
import { gsap, prefersReducedMotion, useGSAP } from "../lib/motion";
import { Dots } from "./search-bar";

export type QuizStatus = "loading" | "ready" | "error";

type Props = {
  card: Explanation;
  quizStatus: QuizStatus;
  onStartQuiz: () => void;
  onRetryQuiz: () => void;
};

const SOURCE_LABEL: Record<Explanation["source"], string> = {
  glossary: "From the glossary",
  "glossary+llm": "Glossary + AI",
  llm: "AI generated",
};

export default function TermCard({ card, quizStatus, onStartQuiz, onRetryQuiz }: Props) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      // The one-liner types itself in, word by word.
      gsap.from(".word", { autoAlpha: 0, y: 8, filter: "blur(4px)", duration: 0.5, stagger: 0.025, delay: 0.15 });
      gsap.from(".underline-bar", { scaleX: 0, transformOrigin: "left", duration: 0.9, delay: 0.3, ease: "expo.out" });
    },
    { scope: root },
  );

  // Pulse the quiz button once when the quiz finishes generating in the background.
  useGSAP(
    () => {
      if (quizStatus !== "ready" || prefersReducedMotion()) return;
      gsap.fromTo(".quiz-cta", { scale: 0.97 }, { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.5)" });
    },
    { dependencies: [quizStatus], scope: root },
  );

  return (
    <article ref={root} className="flex flex-col gap-5">
      <header data-animate className="reveal flex flex-wrap items-center gap-x-3 gap-y-2">
        {card.category && (
          <span className="rounded-full bg-accent-soft px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-accent">
            {card.category}
          </span>
        )}
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted">{SOURCE_LABEL[card.source]}</span>
      </header>

      <div data-animate className="reveal">
        <h2 className="font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl">{card.term}</h2>
        <div className="underline-bar mt-4 h-px w-24 bg-accent" />
      </div>

      <section data-animate className="reveal rounded-3xl border border-line bg-surface p-6 sm:p-8">
        <Label>In one line</Label>
        <p className="mt-3 text-xl leading-relaxed sm:text-2xl">
          {card.one_liner.split(" ").map((w, i) => (
            <span key={i} className="word inline-block whitespace-pre">
              {w}{" "}
            </span>
          ))}
        </p>
      </section>

      <div className="grid gap-5 sm:grid-cols-2">
        <Insight icon={<BrainIcon />} label="Mental model" text={card.mental_model} />
        <Insight icon={<GlobeIcon />} label="Real-world example" text={card.real_world_example} />
      </div>

      <div data-animate className="reveal flex flex-col items-start gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">Think you&apos;ve got it? Three questions will tell.</p>
        {quizStatus === "error" ? (
          <button onClick={onRetryQuiz} className="rounded-xl border border-line px-5 py-3 text-sm font-medium hover:bg-surface">
            Quiz failed to load. Retry
          </button>
        ) : (
          <button
            onClick={onStartQuiz}
            disabled={quizStatus !== "ready"}
            className="quiz-cta group inline-flex items-center gap-3 rounded-xl bg-accent px-6 py-3.5 text-sm font-medium text-white shadow-[0_10px_30px_-10px_var(--accent)] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
          >
            {quizStatus === "loading" ? (
              <>
                <Dots /> Preparing your quiz
              </>
            ) : (
              <>
                Test yourself
                <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
              </>
            )}
          </button>
        )}
      </div>
    </article>
  );
}

function Insight({ icon, label, text }: { icon: React.ReactNode; label: string; text: string }) {
  return (
    <section data-animate className="reveal flex flex-col gap-3 rounded-3xl border border-line bg-surface/70 p-6 backdrop-blur">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-accent">{icon}</span>
        <Label>{label}</Label>
      </div>
      <p className="leading-relaxed text-ink/90">{text}</p>
    </section>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">{children}</p>;
}

const BrainIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M9 4a3 3 0 0 0-3 3v.2A3 3 0 0 0 4 10a3 3 0 0 0 1.2 2.4A3 3 0 0 0 6 17a3 3 0 0 0 3 3V4Zm6 0a3 3 0 0 1 3 3v.2A3 3 0 0 1 20 10a3 3 0 0 1-1.2 2.4A3 3 0 0 1 18 17a3 3 0 0 1-3 3V4Z" />
  </svg>
);

const GlobeIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
  </svg>
);
