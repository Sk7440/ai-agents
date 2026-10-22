"use client";

import { useEffect, useState } from "react";
import { AUDIENCES, STEPS, type Audience, type Term } from "@/app/lib/demo/data";
import { useStream } from "@/app/lib/demo/hooks";
import { useDemo } from "@/app/lib/demo/store";
import { Icon } from "./icons";
import { Notice, ShiftingFlag, SourceLine } from "./ui";

const RETRIEVE_LABEL = {
  glossary: "Retrieving sources… checking the verified glossary",
  retrieved: "Retrieving sources… searching indexed docs",
  ai: "Retrieving sources… none found, using model knowledge",
} as const;

export function ExplainerCard({ term, onFinished }: { term: Term; onFinished?: () => void }) {
  const { state, dispatch } = useDemo();
  const [audience, setAudience] = useState<Audience>("beginner");
  const [step, setStep] = useState(0);
  const [nonce, setNonce] = useState(0);
  const [retrieve, setRetrieve] = useState(true);

  // Glossary entries may not have every layer yet; only show the ones that exist.
  const steps = STEPS.filter((st) => term.audiences[audience][st.key]);
  const last = steps.length - 1;
  const text = term.audiences[audience][steps[step].key];
  const stream = useStream(text, `${term.id}|${audience}|${step}|${nonce}`, { retrieve, speed: retrieve ? 30 : 18 });

  const unlocked = state.unlockedAudiences[term.id] ?? [];
  const isFree = (a: Audience) => term.cached.includes(a) || unlocked.includes(a);
  const learned = state.learned.includes(term.id);
  const bookmarked = state.bookmarks.includes(term.id);
  const hidden = state.safeMode && term.source === "ai";

  useEffect(() => {
    if (state.justAdded !== term.id) return;
    const t = window.setTimeout(() => dispatch({ type: "clearJustAdded" }), 1700);
    return () => window.clearTimeout(t);
  }, [state.justAdded, term.id, dispatch]);

  const chooseAudience = (a: Audience) => {
    if (a === audience) return;
    if (!isFree(a)) {
      if (state.credits < 1) {
        dispatch({ type: "toast", message: "Not enough credits for a new audience version. Cached versions are still free.", tone: "error" });
        return;
      }
      dispatch({ type: "unlockAudience", id: term.id, audience: a });
    }
    setAudience(a);
    setRetrieve(true);
    setNonce((n) => n + 1);
  };

  const goStep = (i: number) => {
    if (i === step) return;
    setStep(i);
    setRetrieve(false);
  };

  const finish = () => {
    dispatch({ type: "completeCard", id: term.id });
    onFinished?.();
  };

  const audienceLabel = AUDIENCES.find((a) => a.id === audience)!.label;

  return (
    <article className={`clay overflow-hidden ${state.justAdded === term.id ? "added-glow" : ""}`} aria-labelledby={`h-${term.id}`}>
      {/* Header */}
      <div className="flex flex-col gap-4 p-5 pb-4 sm:p-7 sm:pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={`h-${term.id}`} className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              {term.name}
            </h2>
            {term.fullName && <p className="mt-1 text-sm font-semibold text-muted">{term.fullName}</p>}
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: "toggleBookmark", id: term.id })}
            aria-pressed={bookmarked}
            className={`btn shrink-0 !px-3.5 ${bookmarked ? "bg-primary-soft text-primary-text" : "btn-soft"}`}
          >
            <Icon name="bookmark" size={17} fill={bookmarked ? "currentColor" : "none"} />
            <span className="hidden sm:inline">{bookmarked ? "In deck" : "Save to deck"}</span>
            <span className="sr-only sm:hidden">{bookmarked ? "Remove from deck" : "Save to deck"}</span>
          </button>
        </div>
        <SourceLine term={term} />
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="clock" size={14} /> Last reviewed {term.lastReviewed}
          </span>
          {term.shifting && <ShiftingFlag />}
        </div>

        {term.basic ? (
          <p className="inline-flex w-fit items-center gap-2 rounded-full bg-card-2 px-3.5 py-2 text-xs font-bold text-muted">
            <Icon name="layers" size={14} />
            {term.category ? `${term.category} · ` : ""}Core glossary entry · one level for everyone
          </p>
        ) : (
        <div role="radiogroup" aria-label="Explain for" className="clay-in flex w-full gap-1 rounded-full p-1.5 sm:w-fit">
          {AUDIENCES.map((a) => {
            const on = a.id === audience;
            const free = isFree(a.id);
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => chooseAudience(a.id)}
                className={`flex min-h-[44px] flex-1 flex-col items-center justify-center rounded-full px-3 py-1 text-[13px] font-bold leading-tight transition sm:flex-none sm:px-4 ${
                  on ? "bg-primary text-primary-ink shadow-[var(--clay-btn)]" : "text-ink hover:bg-card"
                }`}
              >
                <span className="whitespace-nowrap">{a.id === "pm" ? <><span className="sm:hidden">PM</span><span className="hidden sm:inline">{a.label}</span></> : a.label}</span>
                <span className={`text-[10px] font-semibold ${on ? "opacity-90" : "text-muted"}`}>
                  {free ? "Cached · free" : "1 credit"}
                </span>
              </button>
            );
          })}
        </div>
        )}
      </div>

      {/* Stepper */}
      <ol className="flex gap-1.5 overflow-x-auto px-5 sm:px-7" aria-label="Explanation steps">
        {steps.map((s, i) => {
          const on = i === step;
          const done = i < step;
          return (
            <li key={s.key} className="flex-1">
              <button
                type="button"
                onClick={() => goStep(i)}
                aria-current={on ? "step" : undefined}
                className={`flex min-h-[44px] w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-[13px] font-bold transition ${
                  on ? "bg-primary-soft text-primary-text" : "text-muted hover:bg-card-2"
                }`}
              >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] ${
                    done ? "bg-mint text-mint-ink" : on ? "bg-primary text-primary-ink" : "bg-card-2 text-muted"
                  }`}
                >
                  {done ? <Icon name="check" size={13} /> : i + 1}
                </span>
                <span className={`${on ? "inline" : "hidden md:inline"} whitespace-nowrap`}>{s.label}</span>
                {done && <span className="sr-only">(completed)</span>}
              </button>
            </li>
          );
        })}
      </ol>

      {/* Body */}
      <div className="p-5 pt-4 sm:p-7 sm:pt-5">
        {hidden ? (
          <div className="clay-in rounded-3xl p-5">
            <Notice tone="warn" icon="shield">
              <p className="font-bold">Hidden by Safe mode</p>
              <p className="mt-1">This entry is AI-generated and not yet verified. Safe mode shows only glossary-verified or retrieved entries.</p>
            </Notice>
            <button type="button" className="btn btn-soft mt-4" onClick={() => dispatch({ type: "toggleSafe" })}>
              Turn off Safe mode to view
            </button>
          </div>
        ) : (
          <div className="clay-in rounded-3xl p-5 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                Step {step + 1} of {steps.length} · {steps[step].label}{term.basic ? "" : ` · for ${audienceLabel}`}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-primary-text" aria-live="polite">
                  {stream.phase === "retrieving" && (
                    <span className="inline-flex items-center gap-2">
                      <span className="dots inline-flex gap-1" aria-hidden="true"><span /><span /><span /></span>
                      {RETRIEVE_LABEL[term.source]}
                    </span>
                  )}
                  {stream.phase === "writing" && (
                    <span className="inline-flex items-center gap-2">
                      <Icon name="edit" size={13} /> Writing…
                    </span>
                  )}
                  {stream.phase === "stopped" && "Stopped"}
                </span>
                {stream.streaming && (
                  <button type="button" onClick={stream.stop} className="btn btn-soft !min-h-[36px] !px-3 !text-xs">
                    <Icon name="stop" size={13} /> Stop
                  </button>
                )}
              </div>
            </div>

            <div aria-live="polite" aria-busy={stream.streaming} className="min-h-[7.5rem]">
              {stream.phase === "retrieving" ? (
                <div className="space-y-2.5 pt-1" aria-hidden="true">
                  <div className="shimmer h-4 w-11/12 rounded-full" />
                  <div className="shimmer h-4 w-9/12 rounded-full" />
                  <div className="shimmer h-4 w-10/12 rounded-full" />
                </div>
              ) : (
                <p className={`text-lg leading-relaxed text-ink sm:text-xl ${stream.phase === "writing" ? "caret" : ""} ${step === 0 ? "font-display font-semibold" : ""}`}>
                  {stream.shown}
                </p>
              )}
              {stream.phase === "stopped" && (
                <button type="button" onClick={stream.finish} className="btn btn-ghost mt-2 !min-h-[36px] !px-3 !text-sm">
                  Show the full text
                </button>
              )}
            </div>
          </div>
        )}

        {/* Nav */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <button type="button" className="btn btn-soft" onClick={() => goStep(step - 1)} disabled={step === 0}>
            <Icon name="chevronLeft" size={17} /> Back
          </button>
          {step < last ? (
            <button type="button" className="btn btn-primary" onClick={() => goStep(step + 1)}>
              Next: {steps[step + 1].label} <Icon name="chevronRight" size={17} />
            </button>
          ) : learned ? (
            <button type="button" className="btn btn-soft" onClick={onFinished}>
              <Icon name="checkCircle" size={17} className="text-mint-ink" /> Completed · Explain it back
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={finish}>
              <Icon name="check" size={17} /> Finish card · +10 XP
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
