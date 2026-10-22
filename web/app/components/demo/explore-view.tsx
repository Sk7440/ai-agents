"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORIES, draftFor } from "@/app/lib/demo/data";
import { useDemo, visibleTerms } from "@/app/lib/demo/store";
import { ApprovalCard } from "./approval-card";
import { ExplainerCard } from "./explainer-card";
import { Icon } from "./icons";
import { ExplainBack, McqQuiz } from "./quiz";
import { PairsPanel, TermOfTheDay } from "./rail";
import { useSubmitSearch } from "./search-box";
import { Eyebrow, Panel, SourceBadge } from "./ui";

const POPULAR = ["RAG", "Embeddings", "Temperature", "Agent", "Prompt injection", "Tool calling"];

export function ExploreView() {
  const { state, dispatch } = useDemo();
  const submit = useSubmitSearch();
  const ebRef = useRef<HTMLElement>(null);
  const term = state.openTermId ? state.terms[state.openTermId] : null;

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }, [state.openTermId, state.draft?.query, state.didYouMean?.query]);

  if (state.draft) return <ApprovalCard key={state.draft.query} draft={state.draft} />;

  if (state.didYouMean) {
    const s = state.terms[state.didYouMean.suggestion];
    const q = state.didYouMean.query;
    return (
      <Panel className="pop-in">
        <Eyebrow>No exact match for &ldquo;{q}&rdquo;</Eyebrow>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">
          Did you mean <span className="text-primary-text">{s.name}</span>?
        </h1>
        <p className="mt-2 text-muted">{s.audiences.beginner.oneLiner}</p>
        <div className="mt-3"><SourceBadge source={s.source} small /></div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "openTerm", id: s.id, via: "search" })}>
            Open {s.name} <Icon name="arrowRight" size={16} />
          </button>
          <button type="button" className="btn btn-soft" onClick={() => dispatch({ type: "startDraft", query: q, fields: draftFor(q) })}>
            No, draft &ldquo;{q}&rdquo; as a new term · 1 credit
          </button>
        </div>
      </Panel>
    );
  }

  if (term) {
    return (
      <div className="space-y-6">
        <button type="button" className="btn btn-ghost -ml-2 !min-h-[36px]" onClick={() => dispatch({ type: "closeTerm" })}>
          <Icon name="chevronLeft" size={16} /> Explore home
        </button>
        <ExplainerCard
          key={term.id}
          term={term}
          onFinished={() => {
            window.setTimeout(() => {
              ebRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              ebRef.current?.focus({ preventScroll: true });
            }, 50);
          }}
        />
        <ExplainBack key={`eb-${term.id}`} ref={ebRef} term={term} />
        <PairsPanel key={`pairs-${term.id}`} only={term.id} />
        <McqQuiz />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="clay relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-peach opacity-70" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-mint opacity-70" aria-hidden="true" />
        <div className="relative">
          <Eyebrow>Explore</Eyebrow>
          <h1 className="mt-2 max-w-xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            Which AI term is confusing you today?
          </h1>
          <p className="mt-3 max-w-lg text-muted">
            Search any of {visibleTerms(state).length} terms. You&apos;ll get a one-liner, a mental model, a real example, and a deeper dive, then explain it back to lock it in.
          </p>
          <ul className="mt-5 flex flex-wrap gap-2" aria-label="Popular terms">
            {POPULAR.map((p) => (
              <li key={p}>
                <button type="button" className="btn btn-soft !min-h-[40px] !text-sm" onClick={() => submit(p)}>{p}</button>
              </li>
            ))}
            <li>
              <button type="button" className="btn btn-ghost !min-h-[40px] !text-sm" onClick={() => submit("speculative decoding")}>
                <Icon name="spark" size={15} /> Try one not in the glossary
              </button>
            </li>
          </ul>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <TermOfTheDay large />
        <section className="clay flex flex-col p-6 sm:p-7" aria-labelledby="due-title">
          <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary-text">
            <Icon name="repeat" size={13} /> Spaced review
          </p>
          <h2 id="due-title" className="mt-3 font-display text-3xl font-extrabold tracking-tight">
            {state.due.length ? `${state.due.length} terms due` : "All caught up"}
          </h2>
          <p className="mt-2 flex-1 text-muted">
            {state.due.length
              ? `Clear today's queue to grow your ${state.streak}-day streak.`
              : "Nice work. Anything you miss in a quiz will come back here."}
          </p>
          <button type="button" className="btn btn-primary mt-4 w-fit" onClick={() => dispatch({ type: "nav", view: "review" })}>
            {state.due.length ? "Start review" : "Open review"} <Icon name="arrowRight" size={16} />
          </button>
        </section>
      </div>

      <GlossaryBrowser />

      <PairsPanel />
    </div>
  );
}

const PREVIEW = 36;

function GlossaryBrowser() {
  const { state, dispatch } = useDemo();
  const [category, setCategory] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const terms = visibleTerms(state)
    .filter((t) => !category || t.category === category)
    .sort((a, b) => a.name.localeCompare(b.name));
  const shown = all ? terms : terms.slice(0, PREVIEW);

  return (
    <section className="clay p-5 sm:p-6" aria-labelledby="browse-title">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary-soft text-primary-text"><Icon name="layers" size={19} /></span>
        <div>
          <Eyebrow>{visibleTerms(state).length} terms</Eyebrow>
          <h2 id="browse-title" className="font-display text-xl font-bold">Browse the glossary</h2>
        </div>
      </div>

      <div role="group" aria-label="Filter by topic" className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {[null, ...CATEGORIES].map((c) => {
          const on = c === category;
          return (
            <button
              key={c ?? "all"}
              type="button"
              aria-pressed={on}
              onClick={() => { setCategory(c); setAll(false); }}
              className={`min-h-[40px] shrink-0 whitespace-nowrap rounded-full px-3.5 text-[13px] font-bold transition ${
                on ? "bg-primary text-primary-ink shadow-[var(--clay-btn)]" : "bg-card-2 text-ink hover:bg-primary-soft"
              }`}
            >
              {c ?? "All topics"}
            </button>
          );
        })}
      </div>

      <ul className="mt-4 flex flex-wrap gap-2" aria-live="polite">
        {shown.map((t) => {
          const learned = state.learned.includes(t.id);
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => dispatch({ type: "openTerm", id: t.id })}
                className="btn-soft inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition hover:-translate-y-px"
              >
                {learned && (
                  <>
                    <Icon name="check" size={13} className="text-mint-ink" />
                    <span className="sr-only">Learned: </span>
                  </>
                )}
                {t.name}
              </button>
            </li>
          );
        })}
      </ul>
      {terms.length > PREVIEW && (
        <button type="button" className="btn btn-ghost mt-3" onClick={() => setAll(!all)} aria-expanded={all}>
          {all ? "Show fewer" : `Show all ${terms.length}`}
        </button>
      )}
    </section>
  );
}
