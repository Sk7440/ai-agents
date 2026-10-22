"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BADGES, SAMPLE_JOB, SAMPLE_TWEET, type Mastery } from "@/app/lib/demo/data";
import { useReducedMotion } from "@/app/lib/demo/hooks";
import { findTermsInText, type Segment } from "@/app/lib/demo/search";
import { XP_PER_LEVEL, badgeProgress, levelOf, useDemo } from "@/app/lib/demo/store";
import { Icon, type IconName } from "./icons";
import { EmptyState, Eyebrow, MasteryChip, Notice, Panel, SourceBadge } from "./ui";

/* ---------------- Paste-to-explain ---------------- */

const MAX_CHARS = 1500;

export function PasteView() {
  const { state, dispatch } = useDemo();
  const reduced = useReducedMotion();
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "scanning" | "done" | "error">("idle");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [error, setError] = useState("");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const scan = (value: string) => {
    window.clearTimeout(timer.current);
    if (!value.trim()) return;
    if (value.length > MAX_CHARS) {
      setStatus("error");
      setError(`That's ${value.length.toLocaleString()} characters. Paste up to ${MAX_CHARS.toLocaleString()} at a time.`);
      return;
    }
    setStatus("scanning");
    timer.current = window.setTimeout(
      () => {
        const segs = findTermsInText(Object.values(state.terms), value);
        if (!segs.some((s) => s.termId)) {
          setStatus("error");
          setError("No AI terms found in this text. Try one of the samples to see how it works.");
          return;
        }
        setSegments(segs);
        setStatus("done");
      },
      reduced ? 0 : 800,
    );
  };

  const loadSample = (s: string) => {
    setText(s);
    scan(s);
  };

  const found = useMemo(() => [...new Set(segments.filter((s) => s.termId).map((s) => s.termId!))], [segments]);
  const unlearned = found.filter((id) => !state.learned.includes(id));

  return (
    <div className="space-y-6">
      <header>
        <Eyebrow>Paste-to-explain</Eyebrow>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Decode any paragraph</h1>
        <p className="mt-2 max-w-xl text-muted">Paste a tweet, job post, or lecture note. Every AI term gets highlighted so you can learn it in place.</p>
      </header>

      <Panel>
        <label htmlFor="paste-text" className="text-sm font-bold">Your text</label>
        <textarea
          id="paste-text"
          rows={5}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          placeholder="Paste a paragraph that mentions AI terms…"
          aria-describedby="paste-count"
          className="clay-in mt-2 w-full resize-y rounded-3xl p-4 text-base leading-relaxed text-ink outline-none placeholder:text-muted focus-visible:outline-[3px] focus-visible:outline-[var(--focus)]"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-primary" disabled={!text.trim() || status === "scanning"} onClick={() => scan(text)}>
            <Icon name="search" size={17} /> {status === "scanning" ? "Finding terms…" : "Find terms"}
          </button>
          <button type="button" className="btn btn-soft" onClick={() => loadSample(SAMPLE_TWEET)}>Sample tweet</button>
          <button type="button" className="btn btn-soft" onClick={() => loadSample(SAMPLE_JOB)}>Sample job post</button>
          {text && (
            <button type="button" className="btn btn-ghost" onClick={() => { setText(""); setStatus("idle"); setSegments([]); }}>Clear</button>
          )}
          <span id="paste-count" className={`ml-auto text-xs font-semibold ${text.length > MAX_CHARS ? "text-bad-ink" : "text-muted"}`}>
            {text.length}/{MAX_CHARS}
          </span>
        </div>
      </Panel>

      <div aria-live="polite" aria-busy={status === "scanning"}>
        {status === "idle" && (
          <Panel>
            <EmptyState icon="clipboard" title="Nothing to explain yet" body="Paste some text above, or load the sample tweet to try it." />
          </Panel>
        )}
        {status === "scanning" && (
          <Panel>
            <p className="flex items-center gap-2 text-sm font-bold text-primary-text">
              <span className="dots inline-flex gap-1" aria-hidden="true"><span /><span /><span /></span>
              Matching against the glossary…
            </p>
            <div className="mt-4 space-y-2.5">
              <div className="shimmer h-4 w-full rounded-full" />
              <div className="shimmer h-4 w-11/12 rounded-full" />
              <div className="shimmer h-4 w-9/12 rounded-full" />
            </div>
          </Panel>
        )}
        {status === "error" && (
          <div role="alert">
            <Notice tone="bad" icon="warning">{error}</Notice>
          </div>
        )}
        {status === "done" && (
          <Panel className="rise-in">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-2 text-sm font-bold text-primary-text">
                <Icon name="layers" size={16} />
                {found.length} terms found · {unlearned.length} you haven&apos;t learned yet
              </span>
            </div>
            <p className="mt-5 text-lg leading-[2.1]">
              {segments.map((s, i) => {
                if (!s.termId) return <span key={i}>{s.text}</span>;
                const t = state.terms[s.termId];
                const isNew = !state.learned.includes(t.id);
                const tipId = `paste-tip-${i}`;
                const hidden = state.safeMode && t.source === "ai";
                return (
                  <span key={i} className="tip-wrap inline">
                    <button
                      type="button"
                      aria-describedby={tipId}
                      onClick={() => dispatch({ type: "openTerm", id: t.id })}
                      className={`rounded-lg px-1.5 py-0.5 font-bold underline decoration-2 underline-offset-4 transition hover:-translate-y-px ${
                        isNew ? "bg-peach text-peach-ink decoration-dotted" : "bg-mint text-mint-ink"
                      }`}
                    >
                      {s.text}
                      <span className="sr-only">{isNew ? " (not learned yet)" : " (learned)"}</span>
                    </button>
                    <span role="tooltip" id={tipId} className="tip">
                      <strong className="block">{t.name}</strong>
                      {hidden ? "AI-generated entry. Hidden while Safe mode is on." : t.audiences.beginner.oneLiner}
                      <span className="mt-1 block opacity-75">Click to open the full card</span>
                    </span>
                  </span>
                );
              })}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-line pt-4 text-xs font-semibold text-muted">
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-peach" aria-hidden="true" /> Not learned yet (dotted underline)</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-mint" aria-hidden="true" /> Learned (solid underline)</span>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

/* ---------------- Review queue ---------------- */

export function ReviewView() {
  const { state, dispatch } = useDemo();
  const [revealed, setRevealed] = useState(false);
  const current = state.due[0] ? state.terms[state.due[0]] : null;

  return (
    <div className="space-y-6">
      <header>
        <Eyebrow>Spaced review</Eyebrow>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Due today</h1>
        <p className="mt-2 max-w-xl text-muted">Terms you missed come back here. Clear the queue to keep your streak going.</p>
      </header>

      <div className="flex flex-wrap gap-3">
        <span className="clay-sm inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold">
          <Icon name="repeat" size={16} className="text-primary-text" /> {state.due.length} due
        </span>
        <span className="clay-sm inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold">
          <Icon name="flame" size={16} className="text-peach-ink" /> {state.streak}-day streak
          {state.streakDoneToday ? " · done today" : " · clear the queue to extend"}
        </span>
      </div>

      {current ? (
        <Panel className="pop-in" key={current.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Eyebrow>Card 1 of {state.due.length}</Eyebrow>
            <SourceBadge source={current.source} small />
          </div>
          <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight">{current.name}</h2>
          <p className="mt-2 text-muted">Say the one-liner in your head first. Then check yourself.</p>
          {!revealed ? (
            <button type="button" className="btn btn-primary mt-5" onClick={() => setRevealed(true)}>
              Reveal answer
            </button>
          ) : (
            <div className="rise-in mt-5 space-y-3">
              <div className="clay-in rounded-3xl p-5">
                <p className="font-display text-lg font-semibold">{current.audiences.beginner.oneLiner}</p>
                <p className="mt-2 text-sm text-muted">{current.audiences.beginner.mentalModel}</p>
              </div>
              <p className="text-sm font-bold">Did you remember it?</p>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setRevealed(false);
                    dispatch({ type: "reviewResult", id: current.id, gotIt: true });
                  }}
                >
                  <Icon name="check" size={17} /> Got it
                </button>
                <button
                  type="button"
                  className="btn btn-soft"
                  onClick={() => {
                    setRevealed(false);
                    dispatch({ type: "reviewResult", id: current.id, gotIt: false });
                  }}
                >
                  <Icon name="repeat" size={17} /> Still fuzzy, show again
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: "openTerm", id: current.id })}>
                  Open full card
                </button>
              </div>
            </div>
          )}
        </Panel>
      ) : (
        <Panel>
          {state.streakDoneToday ? (
            <EmptyState icon="flame" title={`Queue cleared. ${state.streak}-day streak!`} body="Come back tomorrow to keep it going. Wrong quiz answers will show up here." />
          ) : (
            <EmptyState icon="checkCircle" title="Nothing due right now" body="Answer quizzes and explain terms back. Anything you miss will appear here." />
          )}
        </Panel>
      )}

      {state.due.length > 1 && (
        <Panel>
          <h3 className="font-display text-lg font-bold">Up next</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {state.due.slice(1).map((id) => (
              <li key={id} className="rounded-full bg-card-2 px-3.5 py-2 text-sm font-bold">{state.terms[id].name}</li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

/* ---------------- Deck ---------------- */

export function DeckView() {
  const { state, dispatch } = useDemo();
  const [filter, setFilter] = useState<"all" | Mastery>("all");
  const items = state.bookmarks.map((id) => ({ t: state.terms[id], m: (state.mastery[id] ?? "new") as Mastery }));
  const count = (m: Mastery) => items.filter((i) => i.m === m).length;
  const shown = filter === "all" ? items : items.filter((i) => i.m === filter);
  const tabs: { id: "all" | Mastery; label: string; n: number }[] = [
    { id: "all", label: "All", n: items.length },
    { id: "new", label: "New", n: count("new") },
    { id: "learning", label: "Learning", n: count("learning") },
    { id: "mastered", label: "Mastered", n: count("mastered") },
  ];

  return (
    <div className="space-y-6">
      <header>
        <Eyebrow>Personal deck</Eyebrow>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Your saved terms</h1>
        <p className="mt-2 max-w-xl text-muted">Bookmark terms from any card. Mastery moves from New to Learning to Mastered as you practise.</p>
      </header>

      <div role="tablist" aria-label="Filter by mastery" className="clay-in flex w-fit max-w-full gap-1 overflow-x-auto rounded-full p-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={filter === tab.id}
            onClick={() => setFilter(tab.id)}
            className={`min-h-[40px] whitespace-nowrap rounded-full px-4 text-sm font-bold ${filter === tab.id ? "bg-primary text-primary-ink" : "hover:bg-card"}`}
          >
            {tab.label} <span className={filter === tab.id ? "opacity-85" : "text-muted"}>{tab.n}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Panel>
          <EmptyState icon="bookmark" title={items.length ? "No terms in this group" : "Your deck is empty"} body="Use Save to deck on any explainer card to collect terms here." />
        </Panel>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {shown.map(({ t, m }) => (
            <li key={t.id} className="clay flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-display text-xl font-extrabold">{t.name}</h2>
                <MasteryChip mastery={m} />
              </div>
              <p className="mt-2 flex-1 text-sm text-muted">{t.audiences.beginner.oneLiner}</p>
              <div className="mt-3"><SourceBadge source={t.source} small /></div>
              <div className="mt-4 flex gap-2">
                <button type="button" className="btn btn-soft flex-1" onClick={() => dispatch({ type: "openTerm", id: t.id })}>Study</button>
                <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: "toggleBookmark", id: t.id })}>
                  Remove<span className="sr-only"> {t.name} from deck</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- Progress & badges ---------------- */

const BADGE_TONE = ["bg-peach text-peach-ink", "bg-sun text-sun-ink", "bg-mint text-mint-ink", "bg-primary-soft text-primary-text"];

export function ProgressView() {
  const { state } = useDemo();
  const level = levelOf(state.xp);
  const into = state.xp % XP_PER_LEVEL;
  const low = state.credits <= 3;

  const stats: { icon: IconName; label: string; value: string; tone: string }[] = [
    { icon: "flame", label: "Day streak", value: String(state.streak), tone: "bg-peach text-peach-ink" },
    { icon: "coin", label: low ? "Credits · low" : "Credits", value: String(state.credits), tone: low ? "bg-warn-bg text-warn-ink" : "bg-sun text-sun-ink" },
    { icon: "layers", label: "Terms learned", value: String(state.learned.length), tone: "bg-mint text-mint-ink" },
    { icon: "repeat", label: "Due today", value: String(state.due.length), tone: "bg-primary-soft text-primary-text" },
  ];

  return (
    <div className="space-y-6">
      <header>
        <Eyebrow>Progress</Eyebrow>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Your progress</h1>
      </header>

      <Panel className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary-soft" aria-hidden="true" />
        <div className="relative flex items-center gap-5">
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-[28px] bg-primary font-display text-3xl font-extrabold text-primary-ink shadow-[var(--clay-btn)]">
            {level}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-bold">Level {level}</p>
            <p className="text-sm text-muted">{state.xp} XP total · {XP_PER_LEVEL - into} XP to level {level + 1}</p>
            <div className="clay-in mt-3 h-4 overflow-hidden rounded-full" role="progressbar" aria-label="Progress to next level" aria-valuemin={0} aria-valuemax={XP_PER_LEVEL} aria-valuenow={into}>
              <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${into}%` }} />
            </div>
          </div>
        </div>
        <ul className="relative mt-5 grid gap-2 text-sm sm:grid-cols-3">
          {[
            ["+10", "Card completed"],
            ["+20", "Quiz answer correct"],
            ["+30", "Explain-back score 3/3"],
          ].map(([n, l]) => (
            <li key={l} className="flex items-center gap-2 rounded-2xl bg-card-2 px-3 py-2.5 font-semibold">
              <span className="font-display font-extrabold text-primary-text">{n} XP</span> {l}
            </li>
          ))}
        </ul>
        <p className="relative mt-3 text-xs text-muted">XP comes only from learning. Credits are separate and are spent on new AI drafts and uncached audience versions.</p>
      </Panel>

      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <li key={s.label} className="clay-sm flex flex-col gap-2 p-4">
            <span className={`grid h-10 w-10 place-items-center rounded-2xl ${s.tone}`}><Icon name={s.icon} size={19} /></span>
            <span className="font-display text-3xl font-extrabold">{s.value}</span>
            <span className="text-xs font-bold text-muted">{s.label}</span>
          </li>
        ))}
      </ul>

      <section aria-labelledby="badges-title">
        <h2 id="badges-title" className="font-display text-2xl font-bold">Badges</h2>
        <p className="text-sm text-muted">{state.earned.length} of {BADGES.length} earned</p>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {BADGES.map((b, i) => {
            const earned = state.earned.includes(b.id);
            const p = badgeProgress(state, b.id);
            return (
              <li key={b.id} className={`clay flex flex-col gap-3 p-5`}>
                <div className="flex items-center justify-between">
                  <span className={`grid h-12 w-12 place-items-center rounded-2xl ${earned ? BADGE_TONE[i % 4] : "bg-card-2 text-muted"}`}>
                    <Icon name={b.icon} size={22} />
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${earned ? "bg-ok-bg text-ok-ink" : "bg-card-2 text-muted"}`}>
                    <Icon name={earned ? "check" : "lock"} size={12} /> {earned ? "Earned" : "Locked"}
                  </span>
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold">{b.name}</h3>
                  <p className="text-sm text-muted">{b.criteria}</p>
                </div>
                {!earned && (
                  <div>
                    <div className="clay-in h-2.5 overflow-hidden rounded-full" role="progressbar" aria-label={`${b.name} progress`} aria-valuemin={0} aria-valuemax={p.goal} aria-valuenow={p.value}>
                      <div className="h-full rounded-full bg-muted transition-all duration-700" style={{ width: `${(p.value / p.goal) * 100}%` }} />
                    </div>
                    <p className="mt-1 text-xs font-bold text-muted">{p.value}/{p.goal}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
