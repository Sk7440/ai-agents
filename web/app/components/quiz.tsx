"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { Quiz as QuizData } from "../lib/api";
import { exitThen, gsap, prefersReducedMotion, useGSAP } from "../lib/motion";
import { Dots } from "./search-bar";
import { Label } from "./term-card";

const LETTERS = ["A", "B", "C", "D"];

type Props = {
  quiz: QuizData;
  submitting: boolean;
  onExit: () => void;
  onSubmit: (answers: number[]) => void;
};

export default function Quiz({ quiz, submitting, onExit, onSubmit }: Props) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const direction = useRef(1);

  const total = quiz.questions.length;
  const q = quiz.questions[current];
  const chosen = answers[current];
  const isLast = current === total - 1;

  // Each new question slides in from the side it came from.
  useGSAP(
    () => {
      const reduce = prefersReducedMotion();
      gsap.to(".progress-fill", { scaleX: (current + 1) / total, duration: reduce ? 0 : 0.6, ease: "power3.inOut" });
      if (reduce) {
        gsap.set(body.current, { autoAlpha: 1, x: 0 });
        return;
      }
      const tl = gsap.timeline();
      tl.fromTo(body.current, { autoAlpha: 0, x: 40 * direction.current }, { autoAlpha: 1, x: 0, duration: 0.45 })
        .from(".option", { autoAlpha: 0, y: 12, stagger: 0.06, duration: 0.4 }, "<0.1");
    },
    { dependencies: [current], scope: root },
  );

  // Event handlers (not render code), so reading refs here is safe.
  function go(step: 1 | -1) {
    direction.current = step;
    exitThen(body.current, () => setCurrent((c) => c + step), { x: -30 * step, y: 0 });
  }

  function choose(i: number) {
    setAnswers((a) => {
      const next = [...a];
      next[current] = i;
      return next;
    });
    if (!prefersReducedMotion()) {
      gsap.fromTo(root.current?.querySelector(`.option-${i}`) ?? [], { scale: 0.98 }, { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.45)" });
    }
  }

  function next() {
    if (chosen === undefined || submitting) return;
    if (isLast) onSubmit(answers);
    else go(1);
  }

  // Keyboard: 1-4 or A-D to choose, Enter to continue, Backspace/← to go back.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    const key = e.key.toLowerCase();
    if (key === "enter" && e.target instanceof HTMLButtonElement) return; // the button handles its own Enter
    const idx = "1234".includes(key) ? "1234".indexOf(key) : "abcd".indexOf(key);
    if (key.length === 1 && idx >= 0 && idx < q.options.length) choose(idx);
    else if (key === "enter") next();
    else if ((key === "backspace" || key === "arrowleft") && current > 0) go(-1);
  });
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div ref={root} className="flex flex-col gap-6">
      <div data-animate className="reveal flex items-center justify-between">
        <div>
          <Label>Quiz</Label>
          <p className="mt-1 font-serif text-2xl">{quiz.term}</p>
        </div>
        <p className="font-mono text-sm text-muted" aria-live="polite">
          <span className="text-ink">{current + 1}</span> / {total}
        </p>
      </div>

      <div data-animate className="reveal h-1 overflow-hidden rounded-full bg-line">
        <div className="progress-fill h-full origin-left scale-x-0 rounded-full bg-accent" />
      </div>

      <div ref={body} className="flex flex-col gap-5">
        <h3 className="text-2xl font-medium leading-snug tracking-tight sm:text-[1.7rem]">{q.question}</h3>

        <div className="flex flex-col gap-2.5" role="radiogroup" aria-label={q.question}>
          {q.options.map((opt, i) => {
            const selected = chosen === i;
            return (
              <button
                key={`${current}-${i}`}
                role="radio"
                aria-checked={selected}
                onClick={() => choose(i)}
                className={`option option-${i} group flex items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-colors ${
                  selected
                    ? "border-accent bg-accent-soft"
                    : "border-line bg-surface hover:border-ink/25"
                }`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border font-mono text-xs transition-colors ${
                    selected ? "border-accent bg-accent text-white" : "border-line text-muted group-hover:border-ink/30"
                  }`}
                >
                  {LETTERS[i]}
                </span>
                <span className="leading-snug">{opt}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div data-animate className="reveal flex items-center justify-between gap-3 pt-1">
        <button
          onClick={() => (current === 0 ? onExit() : go(-1))}
          className="rounded-xl px-4 py-3 text-sm font-medium text-muted transition hover:bg-surface hover:text-ink"
        >
          ← {current === 0 ? "Back to card" : "Previous"}
        </button>
        <div className="flex items-center gap-4">
          <span className="hidden font-mono text-[11px] text-muted sm:inline">1–4 to pick · Enter to continue</span>
          <button
            onClick={next}
            disabled={chosen === undefined || submitting}
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-ink px-6 text-sm font-medium text-paper transition hover:opacity-90 active:scale-[0.98] disabled:opacity-30"
          >
            {submitting ? <Dots /> : isLast ? "See my result" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}
