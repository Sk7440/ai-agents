"use client";

import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import { BADGES, TERMS, type Audience, type DraftFields, type Mastery, type Term } from "./data";

export type View = "explore" | "paste" | "review" | "deck" | "badges";
export type ToastTone = "success" | "info" | "warn" | "error";
export type Toast = { id: number; message: string; tone: ToastTone };

export type Draft = {
  query: string;
  status: "drafting" | "ready" | "editing" | "error";
  fields: DraftFields;
  error?: string;
};

export type State = {
  terms: Record<string, Term>;
  order: string[];
  view: View;
  openTermId: string | null;
  didYouMean: { query: string; suggestion: string } | null;
  draft: Draft | null;
  xp: number;
  credits: number;
  streak: number;
  streakDoneToday: boolean;
  safeMode: boolean;
  recentSearches: string[];
  recentViewed: string[];
  learned: string[];
  bookmarks: string[];
  mastery: Record<string, Mastery>;
  due: string[];
  unlockedAudiences: Record<string, Audience[]>;
  curated: number;
  pairsViewed: string[];
  mapOpens: number;
  perfectExplain: boolean;
  earned: string[];
  mcqAnswered: Record<string, boolean>;
  toasts: Toast[];
  nextId: number;
  xpPulse: { id: number; amount: number } | null;
  justAdded: string | null;
};

export const XP_PER_LEVEL = 100;
export const levelOf = (xp: number) => Math.floor(xp / XP_PER_LEVEL) + 1;

const initial: State = {
  terms: Object.fromEntries(TERMS.map((t) => [t.id, t])),
  order: TERMS.map((t) => t.id),
  view: "explore",
  openTermId: null,
  didYouMean: null,
  draft: null,
  xp: 240,
  credits: 8,
  streak: 4,
  streakDoneToday: false,
  safeMode: false,
  recentSearches: ["tokens", "embeddings", "context window"],
  recentViewed: ["context-window", "tokens"],
  learned: ["tokens", "hallucination", "temperature", "context-window"],
  bookmarks: ["tokens", "embeddings", "context-window", "hallucination"],
  mastery: { tokens: "mastered", hallucination: "learning", temperature: "learning", "context-window": "learning", embeddings: "new" },
  due: ["hallucination", "temperature", "context-window"],
  unlockedAudiences: {},
  curated: 3,
  pairsViewed: [],
  mapOpens: 5,
  perfectExplain: false,
  earned: ["first-term", "map-explorer"],
  mcqAnswered: {},
  toasts: [],
  nextId: 1,
  xpPulse: null,
  justAdded: null,
};

export function badgeProgress(s: State, id: string): { value: number; goal: number } {
  switch (id) {
    case "first-term":
      return { value: Math.min(s.learned.length, 1), goal: 1 };
    case "streak-7":
      return { value: Math.min(s.streak, 7), goal: 7 };
    case "perfect":
      return { value: s.perfectExplain ? 1 : 0, goal: 1 };
    case "curator":
      return { value: Math.min(s.curated, 5), goal: 5 };
    case "pair-master":
      return { value: Math.min(s.pairsViewed.length, 3), goal: 3 };
    case "map-explorer":
      return { value: Math.min(s.mapOpens, 5), goal: 5 };
    default:
      return { value: 0, goal: 1 };
  }
}

type Action =
  | { type: "nav"; view: View }
  | { type: "openTerm"; id: string; via?: "map" | "search" | "other" }
  | { type: "closeTerm" }
  | { type: "recordSearch"; query: string }
  | { type: "didYouMean"; query: string; suggestion: string }
  | { type: "startDraft"; query: string; fields: DraftFields }
  | { type: "draftReady" }
  | { type: "draftEdit" }
  | { type: "draftSave"; fields: DraftFields }
  | { type: "draftApprove" }
  | { type: "draftReject" }
  | { type: "unlockAudience"; id: string; audience: Audience }
  | { type: "completeCard"; id: string }
  | { type: "explainResult"; id: string; score: number }
  | { type: "mcqAnswer"; id: string; correct: boolean }
  | { type: "reviewResult"; id: string; gotIt: boolean }
  | { type: "toggleBookmark"; id: string }
  | { type: "toggleSafe" }
  | { type: "pairViewed"; id: string }
  | { type: "toast"; message: string; tone: ToastTone }
  | { type: "dismissToast"; id: number }
  | { type: "clearJustAdded" };

function toast(s: State, message: string, tone: ToastTone = "info"): State {
  return { ...s, toasts: [...s.toasts.slice(-3), { id: s.nextId, message, tone }], nextId: s.nextId + 1 };
}

function addXp(s: State, amount: number, reason: string): State {
  const before = levelOf(s.xp);
  let next: State = { ...s, xp: s.xp + amount, xpPulse: { id: s.nextId, amount } };
  next = toast(next, `+${amount} XP · ${reason}`, "success");
  if (levelOf(next.xp) > before) next = toast(next, `Level up! You reached level ${levelOf(next.xp)}.`, "success");
  return next;
}

function addDue(s: State, id: string): State {
  if (s.due.includes(id)) return s;
  return { ...s, due: [...s.due, id], streakDoneToday: false };
}

function checkBadges(s: State): State {
  let next = s;
  for (const b of BADGES) {
    if (next.earned.includes(b.id)) continue;
    const p = badgeProgress(next, b.id);
    if (p.value >= p.goal) {
      next = { ...next, earned: [...next.earned, b.id] };
      next = toast(next, `Badge unlocked: ${b.name}`, "success");
    }
  }
  return next;
}

function reduce(s: State, a: Action): State {
  switch (a.type) {
    case "nav":
      return { ...s, view: a.view };
    case "openTerm": {
      const recentViewed = [a.id, ...s.recentViewed.filter((x) => x !== a.id)].slice(0, 6);
      return {
        ...s,
        view: "explore",
        openTermId: a.id,
        didYouMean: null,
        draft: null,
        recentViewed,
        mapOpens: a.via === "map" ? s.mapOpens + 1 : s.mapOpens,
      };
    }
    case "closeTerm":
      return { ...s, openTermId: null, didYouMean: null };
    case "recordSearch": {
      const q = a.query.trim();
      if (!q) return s;
      const recentSearches = [q, ...s.recentSearches.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 5);
      return { ...s, recentSearches };
    }
    case "didYouMean":
      return { ...s, view: "explore", openTermId: null, draft: null, didYouMean: { query: a.query, suggestion: a.suggestion } };
    case "startDraft": {
      const base = { ...s, view: "explore" as View, openTermId: null, didYouMean: null };
      if (s.credits < 1) {
        return {
          ...base,
          draft: { query: a.query, status: "error", fields: a.fields, error: "You're out of credits, so a new AI draft can't be generated. Learning actions still earn XP." },
        };
      }
      return toast({ ...base, credits: s.credits - 1, draft: { query: a.query, status: "drafting", fields: a.fields } }, "1 credit used to draft a new entry", "info");
    }
    case "draftReady":
      return s.draft ? { ...s, draft: { ...s.draft, status: "ready" } } : s;
    case "draftEdit":
      return s.draft ? { ...s, draft: { ...s.draft, status: "editing" } } : s;
    case "draftSave":
      return s.draft ? { ...s, draft: { ...s.draft, status: "ready", fields: a.fields } } : s;
    case "draftReject":
      return toast({ ...s, draft: null }, "Draft rejected. Nothing was added to the glossary.", "info");
    case "draftApprove": {
      if (!s.draft) return s;
      const f = s.draft.fields;
      const id = f.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const layers = { oneLiner: f.oneLiner, mentalModel: f.mentalModel, example: f.example, deeper: f.deeper };
      const term: Term = {
        id,
        name: f.name,
        aliases: [s.draft.query.toLowerCase()],
        source: "glossary",
        citation: f.sourceUrl ? { title: f.sourceTitle, url: f.sourceUrl } : undefined,
        lastReviewed: "Oct 22, 2026",
        approvedByYou: true,
        prereqs: ["tokens"],
        cached: ["beginner", "developer", "pm"],
        audiences: { beginner: layers, developer: layers, pm: layers },
        keyIdeas: [
          { label: "States what it is in plain words", pattern: /is|means|lets|makes/i },
          { label: "Gives an analogy or how it works", pattern: /like|think|works|by/i },
          { label: "Mentions why it matters", pattern: /fast|better|help|cost|quality|so/i },
        ],
        followUp: `Where would ${f.name} matter in a product you use?`,
        mcq: {
          question: `What best describes ${f.name}?`,
          options: [
            { text: f.oneLiner, correct: true, why: "Correct. That's the approved one-liner." },
            { text: "A way to store embeddings", why: "That describes a vector database." },
            { text: "A setting for creativity", why: "That describes temperature." },
            { text: "A hidden malicious instruction", why: "That describes prompt injection." },
          ],
        },
      };
      let next: State = {
        ...s,
        terms: { ...s.terms, [id]: term },
        order: s.order.includes(id) ? s.order : [...s.order, id],
        draft: null,
        curated: s.curated + 1,
        justAdded: id,
        openTermId: id,
        recentViewed: [id, ...s.recentViewed.filter((x) => x !== id)].slice(0, 6),
      };
      next = toast(next, `"${f.name}" approved and added to the glossary. Curator ${Math.min(next.curated, 5)}/5`, "success");
      return checkBadges(next);
    }
    case "unlockAudience": {
      const have = s.unlockedAudiences[a.id] ?? [];
      return toast(
        { ...s, credits: s.credits - 1, unlockedAudiences: { ...s.unlockedAudiences, [a.id]: [...have, a.audience] } },
        "1 credit used to generate this audience version",
        "info",
      );
    }
    case "completeCard": {
      if (s.learned.includes(a.id)) return s;
      let next: State = {
        ...s,
        learned: [...s.learned, a.id],
        mastery: { ...s.mastery, [a.id]: s.mastery[a.id] === "mastered" ? "mastered" : "learning" },
      };
      next = addXp(next, 10, "card completed");
      return checkBadges(next);
    }
    case "explainResult": {
      let next: State = s;
      if (a.score === 3) {
        next = addXp({ ...next, perfectExplain: true, mastery: { ...next.mastery, [a.id]: "mastered" } }, 30, "perfect explain-back");
      } else if (a.score <= 1) {
        next = toast(addDue(next, a.id), "Added to today's review queue", "info");
      }
      return checkBadges(next);
    }
    case "mcqAnswer": {
      if (a.id in s.mcqAnswered) return s;
      let next: State = { ...s, mcqAnswered: { ...s.mcqAnswered, [a.id]: a.correct } };
      next = a.correct ? addXp(next, 20, "quiz answer correct") : toast(addDue(next, a.id), "Added to today's review queue", "info");
      return next;
    }
    case "reviewResult": {
      const rest = s.due.filter((x) => x !== a.id);
      // "Still fuzzy" sends the term to the back of today's queue.
      let next: State = { ...s, due: a.gotIt ? rest : [...rest, a.id] };
      if (a.gotIt && next.mastery[a.id] !== "mastered") {
        next = { ...next, mastery: { ...next.mastery, [a.id]: "learning" } };
      }
      if (next.due.length === 0 && !next.streakDoneToday) {
        next = toast({ ...next, streak: next.streak + 1, streakDoneToday: true }, `Review queue cleared. Streak is now ${next.streak + 1} days.`, "success");
      }
      return checkBadges(next);
    }
    case "toggleBookmark": {
      const has = s.bookmarks.includes(a.id);
      const next = {
        ...s,
        bookmarks: has ? s.bookmarks.filter((x) => x !== a.id) : [...s.bookmarks, a.id],
        mastery: has || s.mastery[a.id] ? s.mastery : { ...s.mastery, [a.id]: "new" as Mastery },
      };
      return toast(next, has ? "Removed from your deck" : "Saved to your deck", "info");
    }
    case "toggleSafe":
      return toast(
        { ...s, safeMode: !s.safeMode },
        s.safeMode ? "Safe mode off: AI-generated content is visible" : "Safe mode on: only verified and retrieved entries are shown",
        "info",
      );
    case "pairViewed": {
      if (s.pairsViewed.includes(a.id)) return s;
      return checkBadges({ ...s, pairsViewed: [...s.pairsViewed, a.id] });
    }
    case "toast":
      return toast(s, a.message, a.tone);
    case "dismissToast":
      return { ...s, toasts: s.toasts.filter((t) => t.id !== a.id) };
    case "clearJustAdded":
      return { ...s, justAdded: null };
  }
}

const Ctx = createContext<{ state: State; dispatch: React.Dispatch<Action> } | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reduce, initial);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDemo() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDemo must be used inside DemoProvider");
  return v;
}

/** Terms visible under the current safe-mode setting. */
export function visibleTerms(s: State): Term[] {
  return s.order.map((id) => s.terms[id]).filter((t) => !(s.safeMode && t.source === "ai"));
}
