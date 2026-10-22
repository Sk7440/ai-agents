"use client";

import { forwardRef, useEffect, useMemo, useState } from "react";
import type { Term } from "@/app/lib/demo/data";
import { useReducedMotion, useStream } from "@/app/lib/demo/hooks";
import { useDemo, visibleTerms } from "@/app/lib/demo/store";
import { Icon } from "./icons";
import { EmptyState, Eyebrow, Notice, Panel } from "./ui";

type Result = { score: number; got: string[]; missing: string[] };

const VERDICT = [
  "Not quite yet. Let's rebuild it from the mental model.",
  "A start. You have one piece of the idea.",
  "Good. You have most of it, with one gap.",
  "Excellent. You covered every part of the mental model.",
];

export const ExplainBack = forwardRef<HTMLElement, { term: Term }>(function ExplainBack({ term }, ref) {
  const { state, dispatch } = useDemo();
  const reduced = useReducedMotion();
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "reviewing" | "done" | "error">("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [runs, setRuns] = useState(0);
  const learned = state.learned.includes(term.id);
  const verdict = useStream(result ? VERDICT[result.score] : "", `verdict-${runs}`, { speed: 30 });

  const words = text.trim().split(/\s+/).filter(Boolean).length;

  const submit = () => {
    if (words < 6) {
      setStatus("error");
      return;
    }
    setStatus("reviewing");
    setResult(null);
    window.setTimeout(
      () => {
        const got = term.keyIdeas.filter((k) => k.pattern.test(text)).map((k) => k.label);
        const missing = term.keyIdeas.filter((k) => !k.pattern.test(text)).map((k) => k.label);
        const r = { score: got.length, got, missing };
        setResult(r);
        setRuns((n) => n + 1);
        setStatus("done");
        dispatch({ type: "explainResult", id: term.id, score: r.score });
      },
      reduced ? 0 : 1100,
    );
  };

  return (
    <section ref={ref} tabIndex={-1} className="clay p-5 outline-none sm:p-6" aria-labelledby="eb-title">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-peach text-peach-ink">
          <Icon name="edit" size={19} />
        </span>
        <div>
          <Eyebrow>Active recall</Eyebrow>
          <h3 id="eb-title" className="font-display text-xl font-bold">Explain it back</h3>
        </div>
      </div>

      {!learned ? (
        <div className="mt-4">
          <Notice tone="info" icon="lock">
            Finish every step of the {term.name} card to unlock this. Writing it in your own words is where it sticks.
          </Notice>
        </div>
      ) : (
        <>
          <label htmlFor="eb-text" className="mt-4 block text-sm font-semibold text-muted">
            In your own words, what is <strong className="text-ink">{term.name}</strong>? No peeking.
          </label>
          <textarea
            id="eb-text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (status === "error") setStatus("idle");
            }}
            rows={3}
            placeholder={`${term.name} is…`}
            aria-invalid={status === "error"}
            aria-describedby="eb-help"
            className="clay-in mt-2 w-full resize-y rounded-3xl p-4 text-base text-ink outline-none placeholder:text-muted focus-visible:outline-[3px] focus-visible:outline-[var(--focus)]"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p id="eb-help" className="text-xs font-semibold text-muted">
              {words} {words === 1 ? "word" : "words"} · aim for 1–3 sentences · score 3/3 for +30 XP
            </p>
            <button type="button" className="btn btn-primary" onClick={submit} disabled={status === "reviewing" || words === 0}>
              {status === "reviewing" ? "Reviewing…" : status === "done" ? "Try again" : "Get feedback"}
            </button>
          </div>

          {status === "error" && (
            <div className="mt-4" role="alert">
              <Notice tone="bad" icon="warning">
                That&apos;s a bit short to grade. Write at least one full sentence (6+ words).
              </Notice>
            </div>
          )}

          <div aria-live="polite" aria-busy={status === "reviewing"}>
            {status === "reviewing" && (
              <div className="mt-5 space-y-2.5">
                <p className="flex items-center gap-2 text-sm font-bold text-primary-text">
                  <span className="dots inline-flex gap-1" aria-hidden="true"><span /><span /><span /></span>
                  Comparing with the mental model…
                </p>
                <div className="shimmer h-4 w-10/12 rounded-full" />
                <div className="shimmer h-4 w-8/12 rounded-full" />
              </div>
            )}
            {status === "done" && result && (
              <div className="rise-in mt-5 space-y-4">
                <div className="flex items-center gap-4">
                  <div
                    className={`grid h-16 w-16 shrink-0 place-items-center rounded-3xl font-display text-2xl font-extrabold ${
                      result.score === 3 ? "bg-mint text-mint-ink" : result.score === 2 ? "bg-sun text-sun-ink" : "bg-peach text-peach-ink"
                    }`}
                  >
                    {result.score}/3
                  </div>
                  <p className={`font-display text-lg font-semibold ${verdict.phase === "writing" ? "caret" : ""}`}>{verdict.shown}</p>
                </div>
                {verdict.phase === "done" && (
                  <div className="rise-in grid gap-3 sm:grid-cols-2">
                    <div className="rounded-3xl bg-ok-bg p-4 text-ok-ink">
                      <p className="flex items-center gap-2 text-sm font-bold"><Icon name="checkCircle" size={16} /> What you got right</p>
                      <ul className="mt-2 space-y-1.5 text-sm">
                        {result.got.length ? result.got.map((g) => <li key={g}>{g}</li>) : <li>Nothing matched yet. That&apos;s fine; it&apos;s a starting point.</li>}
                      </ul>
                    </div>
                    <div className="rounded-3xl bg-warn-bg p-4 text-warn-ink">
                      <p className="flex items-center gap-2 text-sm font-bold"><Icon name="warning" size={16} /> Missing vs the mental model</p>
                      <ul className="mt-2 space-y-1.5 text-sm">
                        {result.missing.length ? result.missing.map((m) => <li key={m}>{m}</li>) : <li>Nothing missing. Well done.</li>}
                      </ul>
                    </div>
                    <div className="rounded-3xl bg-primary-soft p-4 text-primary-text sm:col-span-2">
                      <p className="flex items-center gap-2 text-sm font-bold"><Icon name="bulb" size={16} /> Follow-up question</p>
                      <p className="mt-1.5 text-sm font-semibold">{term.followUp}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
});

export function McqQuiz() {
  const { state, dispatch } = useDemo();
  const reduced = useReducedMotion();
  const ids = useMemo(() => {
    const vis = new Set(visibleTerms(state).map((t) => t.id));
    const recent = state.recentViewed.filter((id) => vis.has(id));
    return recent.slice(0, 3);
  }, [state]);
  const key = ids.join(",");
  // The quiz "generates" for a moment whenever the set of recent terms changes.
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const loading = !reduced && readyKey !== key;

  useEffect(() => {
    const t = window.setTimeout(() => setReadyKey(key), 700);
    return () => window.clearTimeout(t);
  }, [key]);

  return (
    <Panel>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-sun text-sun-ink">
          <Icon name="target" size={19} />
        </span>
        <div>
          <Eyebrow>Generated from your last {ids.length || 3} terms</Eyebrow>
          <h3 className="font-display text-xl font-bold">Quick check</h3>
        </div>
      </div>

      {ids.length === 0 ? (
        <EmptyState icon="target" title="No questions yet" body="Open a few terms and we'll build a quiz from what you just read." />
      ) : loading ? (
        <div className="mt-5 space-y-3" aria-busy="true" aria-live="polite">
          <p className="sr-only">Generating questions…</p>
          {[0, 1, 2].map((i) => <div key={i} className="shimmer h-16 rounded-3xl" />)}
        </div>
      ) : (
        <ol className="mt-5 space-y-5">
          {ids.map((id, qi) => {
            const t = state.terms[id];
            const choice = picked[id];
            const answered = choice !== undefined;
            return (
              <li key={id} className="clay-in rounded-3xl p-4 sm:p-5">
                <fieldset>
                  <legend className="font-semibold">
                    <span className="text-muted">Q{qi + 1} · {t.name}</span>
                    <span className="mt-1 block text-ink">{t.mcq.question}</span>
                  </legend>
                  <div className="mt-3 grid gap-2">
                    {t.mcq.options.map((o, oi) => {
                      const isPicked = choice === oi;
                      const tone = !answered ? "" : o.correct ? "bg-ok-bg text-ok-ink" : isPicked ? "bg-bad-bg text-bad-ink" : "opacity-80";
                      return (
                        <button
                          key={oi}
                          type="button"
                          disabled={answered}
                          aria-pressed={isPicked}
                          onClick={() => {
                            setPicked((p) => ({ ...p, [id]: oi }));
                            dispatch({ type: "mcqAnswer", id, correct: !!o.correct });
                          }}
                          className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold transition disabled:cursor-default ${
                            answered ? tone : "btn-soft hover:-translate-y-px"
                          }`}
                        >
                          <span className="flex items-start gap-2">
                            {answered && o.correct && <Icon name="checkCircle" size={17} className="mt-px shrink-0" />}
                            {answered && isPicked && !o.correct && <Icon name="x" size={17} className="mt-px shrink-0" />}
                            <span>
                              {o.text}
                              {answered && (o.correct || isPicked) && (
                                <span className="mt-1 block text-xs font-medium">
                                  {o.correct ? "Correct answer. " : "Your answer. "}
                                  {o.why}
                                </span>
                              )}
                              {answered && !o.correct && !isPicked && <span className="mt-1 block text-xs font-medium text-muted">{o.why}</span>}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
