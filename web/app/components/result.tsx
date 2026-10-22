"use client";

import { useRef } from "react";
import type { GradeResult } from "../lib/api";
import { gsap, prefersReducedMotion, useGSAP } from "../lib/motion";
import { Label } from "./term-card";

const VERDICT = {
  mastered: { title: "Mastered", color: "var(--good)", soft: "var(--good-soft)" },
  learned: { title: "Learned", color: "var(--accent)", soft: "var(--accent-soft)" },
  needs_review: { title: "Needs review", color: "var(--warn)", soft: "var(--warn-soft)" },
} as const;

const R = 54;
const CIRCUMFERENCE = 2 * Math.PI * R;

type Props = {
  result: GradeResult;
  onRetake: () => void;
  onReview: () => void;
  onNew: () => void;
};

export default function Result({ result, onRetake, onReview, onNew }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const v = VERDICT[result.verdict];
  const fraction = result.total ? result.score / result.total : 0;

  useGSAP(
    () => {
      const finalOffset = CIRCUMFERENCE * (1 - fraction);
      if (prefersReducedMotion()) {
        gsap.set(".ring", { strokeDashoffset: finalOffset });
        return;
      }
      const counter = { n: 0 };
      gsap
        .timeline({ delay: 0.25 })
        .fromTo(".ring", { strokeDashoffset: CIRCUMFERENCE }, { strokeDashoffset: finalOffset, duration: 1.4, ease: "power2.inOut" })
        .to(counter, {
          n: result.score,
          duration: 1.4,
          ease: "power2.inOut",
          onUpdate: () => {
            if (scoreRef.current) scoreRef.current.textContent = String(Math.round(counter.n));
          },
        }, "<")
        .from(".verdict", { autoAlpha: 0, y: 10, scale: 0.9, duration: 0.6, ease: "back.out(2)" }, "-=0.5");
      if (result.verdict === "mastered") {
        gsap.fromTo(".spark", { scale: 0, autoAlpha: 1 }, {
          scale: 1.6, autoAlpha: 0, duration: 1.1, stagger: 0.08, delay: 1.3, ease: "expo.out",
          x: (i) => Math.cos((i / 8) * Math.PI * 2) * 90,
          y: (i) => Math.sin((i / 8) * Math.PI * 2) * 90,
        });
      }
    },
    { scope: root },
  );

  return (
    <div ref={root} className="flex flex-col gap-6">
      <section
        data-animate
        className="reveal relative flex flex-col items-center gap-6 overflow-hidden rounded-3xl border border-line bg-surface px-6 py-10 text-center sm:flex-row sm:gap-10 sm:px-10 sm:text-left"
      >
        <div className="relative grid h-36 w-36 shrink-0 place-items-center">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} aria-hidden className="spark invisible absolute h-2 w-2 rounded-full" style={{ background: v.color }} />
          ))}
          <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="60" cy="60" r={R} fill="none" stroke="var(--line)" strokeWidth="8" />
            <circle
              className="ring"
              cx="60" cy="60" r={R} fill="none" stroke={v.color} strokeWidth="8"
              strokeLinecap={fraction > 0 ? "round" : "butt"}
              strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE}
            />
          </svg>
          <p className="font-serif text-5xl" aria-label={`${result.score} out of ${result.total}`}>
            <span ref={scoreRef}>{prefersReducedMotion() ? result.score : 0}</span>
            <span className="text-2xl text-muted">/{result.total}</span>
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 sm:items-start">
          <span
            className="verdict rounded-full px-3.5 py-1 font-mono text-xs uppercase tracking-wider"
            style={{ background: v.soft, color: v.color }}
          >
            {v.title}
          </span>
          <p className="font-serif text-3xl leading-tight" role="status">{result.message}</p>
        </div>
      </section>

      <div className="flex flex-col gap-3">
        {result.results.map((r, i) => (
          <details
            key={i}
            data-animate
            open={!r.is_correct}
            className="reveal group rounded-2xl border border-line bg-surface/70 px-5 py-4 backdrop-blur [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer list-none items-start gap-3">
              <span
                className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
                style={{ background: r.is_correct ? "var(--good)" : "var(--bad)" }}
                aria-label={r.is_correct ? "Correct" : "Incorrect"}
              >
                {r.is_correct ? "✓" : "✕"}
              </span>
              <span className="flex-1 font-medium leading-snug">{r.question}</span>
              <span aria-hidden className="text-muted transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <div className="mt-3 flex flex-col gap-2 pl-9 text-sm">
              {!r.is_correct && (
                <p className="text-bad">
                  <span className="text-muted">You chose: </span>
                  <span className="line-through decoration-1">{r.options[r.your_answer]}</span>
                </p>
              )}
              <p>
                <span className="text-muted">Answer: </span>
                <span className="font-medium text-good">{r.options[r.correct_answer]}</span>
              </p>
              <p className="text-muted">{r.explanation}</p>
            </div>
          </details>
        ))}
      </div>

      <div data-animate className="reveal flex flex-wrap gap-3">
        {!result.passed && (
          <button onClick={onReview} className={primary}>Review the card</button>
        )}
        <button onClick={onRetake} className={secondary}>Retake quiz</button>
        <button onClick={onNew} className={result.passed ? primary : secondary}>Learn another term →</button>
      </div>
      <Label>Tip: 2 of 3 correct counts as learned · 3 of 3 is mastered</Label>
    </div>
  );
}

const primary =
  "inline-flex h-12 items-center rounded-xl bg-ink px-6 text-sm font-medium text-paper transition hover:opacity-90 active:scale-[0.98]";
const secondary =
  "inline-flex h-12 items-center rounded-xl border border-line bg-surface px-6 text-sm font-medium transition hover:border-ink/25 active:scale-[0.98]";
