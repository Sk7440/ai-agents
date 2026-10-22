"use client";

import { useSyncExternalStore } from "react";
import type { GradeResult } from "./api";

/** Terms the learner has been quizzed on, kept in this browser only. */
export type Progress = Record<string, { verdict: GradeResult["verdict"]; at: number }>;

const KEY = "termsnap.progress.v1";
const EMPTY: Progress = {};
const listeners = new Set<() => void>();
let cache: Progress | null = null;

function read(): Progress {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Progress;
  } catch {
    cache = {};
  }
  return cache;
}

export function recordResult(term: string, verdict: GradeResult["verdict"]) {
  const prev = read()[term];
  // Never downgrade: once mastered, a weaker retake doesn't erase it.
  const rank = { needs_review: 0, learned: 1, mastered: 2 };
  const best = prev && rank[prev.verdict] > rank[verdict] ? prev.verdict : verdict;
  cache = { ...read(), [term]: { verdict: best, at: Date.now() } };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* private mode or storage full: progress just won't persist */
  }
  listeners.forEach((l) => l());
}

export function useProgress(): Progress {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => EMPTY,
  );
}
