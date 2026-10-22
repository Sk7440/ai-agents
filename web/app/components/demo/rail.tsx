"use client";

import { useState } from "react";
import { PAIRS, TERM_OF_THE_DAY, type Pair } from "@/app/lib/demo/data";
import { useDemo } from "@/app/lib/demo/store";
import { Icon } from "./icons";
import { Eyebrow, SourceBadge } from "./ui";

export function ConceptMap() {
  const { state, dispatch } = useDemo();
  const term = state.openTermId ? state.terms[state.openTermId] : null;

  if (!term) {
    return (
      <section className="clay p-5" aria-labelledby="map-title">
        <Eyebrow>Concept map</Eyebrow>
        <h2 id="map-title" className="mt-1 font-display text-lg font-bold">See how terms connect</h2>
        <p className="mt-2 text-sm text-muted">Open any term to see what to learn first and what builds on it.</p>
      </section>
    );
  }

  const prereqs = term.prereqs.filter((id) => state.terms[id]);
  const builds = state.order.filter((id) => state.terms[id].prereqs.includes(term.id));
  const node = (id: string) => (
    <li key={id}>
      <button
        type="button"
        onClick={() => dispatch({ type: "openTerm", id, via: "map" })}
        className="btn-soft w-full rounded-2xl px-2.5 py-2 text-left text-[13px] font-bold leading-tight transition hover:-translate-y-px"
      >
        {state.terms[id].name}
      </button>
    </li>
  );

  return (
    <section className="clay p-5" aria-labelledby="map-title">
      <div className="flex items-center justify-between">
        <div>
          <Eyebrow>Concept map</Eyebrow>
          <h2 id="map-title" className="mt-1 font-display text-lg font-bold">Around {term.name}</h2>
        </div>
        <Icon name="map" size={22} className="text-primary-text" />
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">Learn first</p>
          {prereqs.length ? <ul className="space-y-2">{prereqs.map(node)}</ul> : <p className="text-xs text-muted">None. Start here.</p>}
        </div>
        <div className="flex flex-col items-center gap-1 px-0.5">
          <Icon name="arrowRight" size={14} className="text-muted" />
          <span className="rounded-2xl bg-primary px-2.5 py-2 text-center text-[13px] font-extrabold leading-tight text-primary-ink shadow-[var(--clay-btn)]">
            {term.name}
          </span>
          <Icon name="arrowRight" size={14} className="text-muted" />
        </div>
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">Builds on it</p>
          {builds.length ? <ul className="space-y-2">{builds.map(node)}</ul> : <p className="text-xs text-muted">Nothing yet.</p>}
        </div>
      </div>
    </section>
  );
}

export function TermOfTheDay({ large }: { large?: boolean }) {
  const { state, dispatch } = useDemo();
  const t = state.terms[TERM_OF_THE_DAY];
  return (
    <section className={`clay relative overflow-hidden ${large ? "p-6 sm:p-7" : "p-5"}`} aria-labelledby={large ? "totd-l" : "totd"}>
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-sun opacity-70" aria-hidden="true" />
      <div className="relative">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-sun px-3 py-1 text-xs font-bold text-sun-ink">
          <Icon name="spark" size={13} /> Term of the day
        </p>
        <h2 id={large ? "totd-l" : "totd"} className={`mt-3 font-display font-extrabold tracking-tight ${large ? "text-3xl" : "text-xl"}`}>
          {t.name}
        </h2>
        <p className={`mt-2 text-muted ${large ? "text-base" : "text-sm"}`}>{t.audiences.beginner.oneLiner}</p>
        <div className="mt-3"><SourceBadge source={t.source} small /></div>
        <button type="button" className="btn btn-soft mt-4" onClick={() => dispatch({ type: "openTerm", id: t.id })}>
          Learn it in 4 steps <Icon name="arrowRight" size={16} />
        </button>
      </div>
    </section>
  );
}

export function PairCompare({ pair }: { pair: Pair }) {
  const { state, dispatch } = useDemo();
  const a = state.terms[pair.a];
  const b = state.terms[pair.b];
  return (
    <div className="rise-in">
      <div className="grid grid-cols-2 gap-3">
        {[a, b].map((t, i) => (
          <div key={t.id} className={`rounded-3xl p-4 ${i === 0 ? "bg-peach text-peach-ink" : "bg-mint text-mint-ink"}`}>
            <button type="button" onClick={() => dispatch({ type: "openTerm", id: t.id })} className="text-left font-display text-lg font-extrabold underline-offset-4 hover:underline">
              {t.name}
            </button>
            <p className="mt-1 text-sm font-medium">{t.audiences.beginner.oneLiner}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-start gap-3 rounded-3xl bg-primary px-5 py-4 text-primary-ink shadow-[var(--clay-btn)]">
        <Icon name="bulb" size={20} className="mt-0.5 shrink-0" />
        <p>
          <span className="block text-xs font-bold uppercase tracking-[0.14em] opacity-90">The one difference</span>
          <span className="font-display text-lg font-bold">{pair.difference}</span>
        </p>
      </div>
      <table className="mt-3 w-full border-separate border-spacing-y-1.5 text-sm">
        <caption className="sr-only">{a.name} compared with {b.name}</caption>
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-muted">
            <th scope="col" className="w-1/4 px-2 font-bold"><span className="sr-only">Aspect</span></th>
            <th scope="col" className="px-2 font-bold">{a.name}</th>
            <th scope="col" className="px-2 font-bold">{b.name}</th>
          </tr>
        </thead>
        <tbody>
          {pair.rows.map((r) => (
            <tr key={r.label} className="bg-card-2">
              <th scope="row" className="rounded-l-2xl px-3 py-2.5 text-left text-xs font-bold text-muted">{r.label}</th>
              <td className="px-2 py-2.5 font-medium">{r.a}</td>
              <td className="rounded-r-2xl px-2 py-2.5 font-medium">{r.b}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <span className="sr-only">{state.pairsViewed.length} of 3 pairs compared</span>
    </div>
  );
}

export function PairsPanel({ only }: { only?: string }) {
  const { state, dispatch } = useDemo();
  const pairs = only ? PAIRS.filter((p) => p.a === only || p.b === only) : PAIRS;
  const [openId, setOpenId] = useState<string | null>(null);
  if (!pairs.length) return null;

  const open = (id: string) => {
    setOpenId(openId === id ? null : id);
    dispatch({ type: "pairViewed", id });
  };

  return (
    <section className="clay p-5 sm:p-6" aria-labelledby={`pairs-${only ?? "all"}`}>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-mint text-mint-ink"><Icon name="pair" size={19} /></span>
        <div>
          <Eyebrow>Often confused</Eyebrow>
          <h3 id={`pairs-${only ?? "all"}`} className="font-display text-xl font-bold">Compare side by side</h3>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {pairs.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-expanded={openId === p.id}
            onClick={() => open(p.id)}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-sm font-bold transition ${
              openId === p.id ? "bg-primary text-primary-ink shadow-[var(--clay-btn)]" : "btn-soft"
            }`}
          >
            {state.terms[p.a].name} <span className={openId === p.id ? "opacity-80" : "text-muted"}>vs</span> {state.terms[p.b].name}
            {state.pairsViewed.includes(p.id) && (
              <>
                <Icon name="check" size={14} />
                <span className="sr-only">(compared)</span>
              </>
            )}
          </button>
        ))}
      </div>
      {openId && <div className="mt-4"><PairCompare pair={PAIRS.find((p) => p.id === openId)!} /></div>}
    </section>
  );
}
