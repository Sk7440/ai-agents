"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

export function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

export type StreamPhase = "retrieving" | "writing" | "done" | "stopped";

/**
 * Simulates an AI response streaming in token by token.
 * `key` restarts the stream; `retrieve` adds a "Retrieving sources…" step first.
 */
export function useStream(text: string, key: string, opts: { retrieve?: boolean; speed?: number } = {}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(text ? "" : text);
  const [phase, setPhase] = useState<StreamPhase>(text ? (opts.retrieve ? "retrieving" : "writing") : "done");
  const timers = useRef<number[]>([]);
  const textRef = useRef(text);
  // Runs before the stream effect below, so it always sees the latest text.
  useEffect(() => {
    textRef.current = text;
  }, [text]);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  useEffect(() => {
    clear();
    const full = textRef.current;
    if (reduced) {
      setShown(full);
      setPhase("done");
      return;
    }
    const tokens = full.match(/\S+\s*/g) ?? [];
    const speed = opts.speed ?? 28;
    setShown("");
    const startWriting = () => {
      setPhase("writing");
      let i = 0;
      const tick = () => {
        i = Math.min(tokens.length, i + 1);
        setShown(tokens.slice(0, i).join(""));
        if (i < tokens.length) timers.current.push(window.setTimeout(tick, speed + Math.random() * speed));
        else setPhase("done");
      };
      tick();
    };
    if (opts.retrieve) {
      setPhase("retrieving");
      timers.current.push(window.setTimeout(startWriting, 750));
    } else {
      startWriting();
    }
    return clear;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reduced]);

  const stop = useCallback(() => {
    clear();
    setPhase((p) => (p === "done" ? p : "stopped"));
  }, []);

  const finish = useCallback(() => {
    clear();
    setShown(textRef.current);
    setPhase("done");
  }, []);

  const streaming = phase === "retrieving" || phase === "writing";
  return { shown, phase, streaming, stop, finish };
}
