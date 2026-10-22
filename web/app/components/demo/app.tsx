"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/app/lib/demo/hooks";
import { DemoProvider, XP_PER_LEVEL, levelOf, useDemo, type Toast, type View } from "@/app/lib/demo/store";
import { ExploreView } from "./explore-view";
import { Icon, type IconName } from "./icons";
import { ConceptMap, TermOfTheDay } from "./rail";
import { SearchBox } from "./search-box";
import { DeckView, PasteView, ProgressView, ReviewView } from "./views";

const NAV: { id: View; label: string; icon: IconName }[] = [
  { id: "explore", label: "Explore", icon: "compass" },
  { id: "paste", label: "Paste-to-explain", icon: "clipboard" },
  { id: "review", label: "Review", icon: "repeat" },
  { id: "deck", label: "Deck", icon: "bookmark" },
  { id: "badges", label: "Badges", icon: "award" },
];
const SHORT: Record<View, string> = { explore: "Explore", paste: "Paste", review: "Review", deck: "Deck", badges: "Badges" };

export default function TermSnapApp() {
  return (
    <DemoProvider>
      <Shell />
    </DemoProvider>
  );
}

function Shell() {
  const { state, dispatch } = useDemo();
  const view = state.view;
  const go = (v: View) => {
    dispatch({ type: "nav", view: v });
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-screen pb-28 lg:pb-10">
      <a href="#main" className="btn btn-primary sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100]">
        Skip to content
      </a>
      <Header />

      <div className="mx-auto grid max-w-[1440px] gap-6 px-4 pt-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-6 xl:grid-cols-[220px_minmax(0,1fr)_320px]">
        {/* Left nav (desktop) */}
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="clay sticky top-28 space-y-1 p-3">
            {NAV.map((n) => {
              const on = view === n.id;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => go(n.id)}
                    aria-current={on ? "page" : undefined}
                    className={`flex min-h-[46px] w-full items-center gap-3 rounded-2xl px-3.5 text-left text-[15px] font-bold transition ${
                      on ? "bg-primary text-primary-ink shadow-[var(--clay-btn)]" : "text-ink hover:bg-card-2"
                    }`}
                  >
                    <Icon name={n.icon} size={19} />
                    <span className="flex-1">{n.label}</span>
                    {n.id === "review" && state.due.length > 0 && (
                      <span className={`grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-extrabold ${on ? "bg-primary-ink text-primary" : "bg-peach text-peach-ink"}`}>
                        {state.due.length}
                        <span className="sr-only"> due</span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <main id="main" tabIndex={-1} className="min-w-0 outline-none">
          {view === "explore" && <ExploreView />}
          {view === "paste" && <PasteView />}
          {view === "review" && <ReviewView />}
          {view === "deck" && <DeckView />}
          {view === "badges" && <ProgressView />}
        </main>

        {/* Right rail: below main on smaller screens */}
        <aside aria-label="Learning context" className="space-y-6 lg:col-start-2 xl:col-start-auto">
          <div className="space-y-6 xl:sticky xl:top-28">
            <ConceptMap />
            <TermOfTheDay />
          </div>
        </aside>
      </div>

      {/* Bottom tab bar (mobile) */}
      <nav aria-label="Main" className="fixed inset-x-3 bottom-3 z-40 lg:hidden">
        <ul className="clay grid grid-cols-5 p-1.5">
          {NAV.map((n) => {
            const on = view === n.id;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => go(n.id)}
                  aria-current={on ? "page" : undefined}
                  className={`relative flex min-h-[56px] w-full flex-col items-center justify-center gap-1 rounded-[20px] text-[11px] font-bold ${
                    on ? "bg-primary text-primary-ink shadow-[var(--clay-btn)]" : "text-muted"
                  }`}
                >
                  <Icon name={n.icon} size={20} />
                  {SHORT[n.id]}
                  {n.id === "review" && state.due.length > 0 && (
                    <span className="absolute right-2 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-peach px-1 text-[10px] font-extrabold text-peach-ink">
                      {state.due.length}
                      <span className="sr-only"> due</span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <Toasts toasts={state.toasts} />
    </div>
  );
}

function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative grid h-10 w-10 place-items-center rounded-[14px] bg-primary text-primary-ink shadow-[var(--clay-btn)]" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="4" width="13" height="13" rx="4" fill="currentColor" opacity="0.55" />
          <rect x="8" y="8" width="13" height="13" rx="4" fill="currentColor" />
        </svg>
      </span>
      <span className="font-display text-xl font-extrabold tracking-tight">TermSnap</span>
    </span>
  );
}

function Header() {
  const { state, dispatch } = useDemo();
  const reduced = useReducedMotion();
  const level = levelOf(state.xp);
  const into = state.xp % XP_PER_LEVEL;
  const low = state.credits <= 3;

  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-base/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-3 gap-y-3 px-4 py-3 lg:flex-nowrap lg:px-6">
        <button type="button" onClick={() => { dispatch({ type: "nav", view: "explore" }); dispatch({ type: "closeTerm" }); }} className="rounded-2xl" aria-label="TermSnap home">
          <Logo />
        </button>

        <div className="order-last w-full lg:order-none lg:mx-4 lg:max-w-xl lg:flex-1">
          <SearchBox />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Safe mode */}
          <span className="tip-wrap tip-below">
            <button
              type="button"
              role="switch"
              aria-checked={state.safeMode}
              aria-describedby="tip-safe"
              onClick={() => dispatch({ type: "toggleSafe" })}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-xs font-bold transition ${
                state.safeMode ? "bg-ok-bg text-ok-ink shadow-[var(--clay-sm)]" : "clay-sm text-ink"
              }`}
            >
              <Icon name={state.safeMode ? "shield" : "shieldOff"} size={16} />
              <span className="hidden sm:inline">Safe mode</span>
              <span className="sm:hidden">Safe</span>
              <span className="font-extrabold">{state.safeMode ? "On" : "Off"}</span>
            </button>
            <span role="tooltip" id="tip-safe" className="tip">
              When on, AI-generated unverified content is hidden. You only see glossary-verified or retrieved entries.
            </span>
          </span>

          {/* Credits */}
          <span className="tip-wrap tip-below">
            <span
              tabIndex={0}
              aria-describedby="tip-credits"
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-xs font-bold ${low ? "bg-warn-bg text-warn-ink" : "clay-sm"}`}
            >
              <Icon name={low ? "warning" : "coin"} size={16} />
              <span className="font-extrabold">{state.credits}</span>
              <span className="hidden sm:inline">{low ? "credits · low" : "credits"}</span>
              <span className="sr-only sm:hidden">credits{low ? ", low" : ""}</span>
            </span>
            <span role="tooltip" id="tip-credits" className="tip">
              Credits are spent on new AI drafts and uncached audience versions (1 each). {low ? "You're running low." : ""}
            </span>
          </span>

          {/* Streak */}
          <span className="clay-sm inline-flex min-h-[40px] items-center gap-1.5 !rounded-full px-3 text-xs font-bold">
            <Icon name="flame" size={16} className="text-peach-ink" />
            <span className="font-extrabold">{state.streak}</span>
            <span className="hidden sm:inline">day streak</span>
            <span className="sr-only sm:hidden">day streak</span>
          </span>

          {/* Level bar */}
          <button
            type="button"
            onClick={() => dispatch({ type: "nav", view: "badges" })}
            className="relative hidden min-h-[40px] items-center gap-2 rounded-full px-1 text-xs font-bold md:inline-flex"
            aria-label={`Level ${level}, ${into} of ${XP_PER_LEVEL} XP to next level. View progress`}
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-ink shadow-[var(--clay-btn)]">{level}</span>
            <span className="flex flex-col items-start gap-1">
              <span className="clay-in block h-2.5 w-24 overflow-hidden rounded-full">
                <span className="block h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${into}%` }} />
              </span>
              <span className="text-[11px] text-muted">{into}/{XP_PER_LEVEL} XP</span>
            </span>
            {state.xpPulse && !reduced && (
              <span key={state.xpPulse.id} className="xp-float pointer-events-none absolute -top-1 right-0 rounded-full bg-mint px-2 py-0.5 text-[11px] font-extrabold text-mint-ink" aria-hidden="true">
                +{state.xpPulse.amount} XP
              </span>
            )}
          </button>

          <ThemeToggle />

          <button
            type="button"
            onClick={() => dispatch({ type: "nav", view: "badges" })}
            className="grid h-10 w-10 place-items-center rounded-full bg-peach font-display text-sm font-extrabold text-peach-ink shadow-[var(--clay-sm)]"
            aria-label="Your profile and progress"
          >
            SK
          </button>
        </div>
      </div>
    </header>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => {
    const stored = (() => {
      try {
        return localStorage.getItem("termsnap-theme");
      } catch {
        return null;
      }
    })();
    const isDark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(isDark);
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem("termsnap-theme", next ? "dark" : "light");
    } catch {}
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className="clay-sm hidden h-10 w-10 place-items-center !rounded-full sm:grid"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
    >
      <Icon name={dark ? "sun" : "moon"} size={18} />
    </button>
  );
}

function Toasts({ toasts }: { toasts: Toast[] }) {
  const { dispatch } = useDemo();
  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((t) => window.setTimeout(() => dispatch({ type: "dismissToast", id: t.id }), 4200));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dispatch]);

  const tone: Record<Toast["tone"], { cls: string; icon: IconName }> = {
    success: { cls: "bg-ok-bg text-ok-ink", icon: "checkCircle" },
    info: { cls: "bg-card text-ink", icon: "info" },
    warn: { cls: "bg-warn-bg text-warn-ink", icon: "warning" },
    error: { cls: "bg-bad-bg text-bad-ink", icon: "warning" },
  };

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-24 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end lg:bottom-6">
      {toasts.map((t) => (
        <div key={t.id} className={`pop-in pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-bold shadow-[var(--clay)] ${tone[t.tone].cls}`}>
          <Icon name={tone[t.tone].icon} size={18} className="shrink-0" />
          <span className="flex-1">{t.message}</span>
          <button type="button" onClick={() => dispatch({ type: "dismissToast", id: t.id })} className="-mr-1 grid h-7 w-7 place-items-center rounded-full hover:bg-black/5" aria-label="Dismiss notification">
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
