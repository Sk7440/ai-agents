"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { fetchTerms, type GlossaryTerm } from "../lib/api";
import { gsap, prefersReducedMotion, useGSAP } from "../lib/motion";

type Props = {
  value: string;
  loading: boolean;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
};

function rank(terms: GlossaryTerm[], query: string) {
  const q = query.trim().toLowerCase();
  if (q.length < 1) return [];
  const scored: { t: GlossaryTerm; s: number }[] = [];
  for (const t of terms) {
    const names = [t.term, ...t.aliases].map((n) => n.toLowerCase());
    let s = 0;
    if (names.some((n) => n === q)) s = 3;
    else if (names.some((n) => n.startsWith(q))) s = 2;
    else if (names.some((n) => n.includes(q))) s = 1;
    if (s) scored.push({ t, s });
  }
  return scored.sort((a, b) => b.s - a.s || a.t.term.length - b.t.term.length).slice(0, 6).map((x) => x.t);
}

export default function SearchBar({ value, loading, onChange, onSubmit }: Props) {
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const matches = useMemo(() => rank(terms, value), [terms, value]);
  const showList = open && matches.length > 0 && !loading;

  useEffect(() => {
    fetchTerms().then(setTerms);
    // "/" focuses the search from anywhere, like most search UIs.
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useGSAP(
    () => {
      if (!showList || prefersReducedMotion()) return;
      gsap.fromTo(listRef.current, { autoAlpha: 0, y: -6, scale: 0.98 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.25 });
      gsap.fromTo("li", { autoAlpha: 0, x: -6 }, { autoAlpha: 1, x: 0, duration: 0.3, stagger: 0.03 });
    },
    { dependencies: [showList], scope: listRef },
  );

  function submit(term: string) {
    setOpen(false);
    setActive(-1);
    onSubmit(term);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showList) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      // Cycle through -1 (the typed text) and each suggestion.
      setActive((i) => {
        const next = i + step;
        return next >= matches.length ? -1 : next < -1 ? matches.length - 1 : next;
      });
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Enter" && active >= 0 && active < matches.length) {
      e.preventDefault();
      onChange(matches[active].term);
      submit(matches[active].term);
    }
  }

  return (
    <form
      className="relative"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submit(value);
      }}
    >
      <div className="group flex items-center gap-2 rounded-2xl border border-line bg-surface/80 p-2 pl-5 shadow-[0_1px_0_rgba(0,0,0,0.02),0_12px_40px_-12px_rgba(0,0,0,0.12)] backdrop-blur-xl transition focus-within:border-accent/60 focus-within:shadow-[0_0_0_4px_var(--accent-soft),0_12px_40px_-12px_rgba(0,0,0,0.15)]">
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          placeholder="Ask about any AI term — RAG, embeddings, LoRA…"
          aria-label="AI term"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          maxLength={200}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-base outline-none placeholder:text-muted/70"
        />
        <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted sm:block">/</kbd>
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="relative inline-flex h-11 items-center gap-2 overflow-hidden rounded-xl bg-ink px-5 text-sm font-medium text-paper transition hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
        >
          {loading ? <Dots /> : "Explain"}
        </button>
      </div>

      {showList && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-line bg-surface/95 p-1.5 shadow-2xl backdrop-blur-xl"
        >
          {matches.map((t, i) => (
            <li
              key={t.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(t.term);
                submit(t.term);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm ${
                i === active ? "bg-accent-soft" : ""
              }`}
            >
              <span>{t.term}</span>
              <span className="font-mono text-[11px] text-muted">{t.category}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

export function Dots() {
  const root = useRef<HTMLSpanElement>(null);
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.to("span", { y: -4, duration: 0.35, repeat: -1, yoyo: true, stagger: 0.12, ease: "sine.inOut" });
    },
    { scope: root },
  );
  return (
    <span ref={root} className="inline-flex items-center gap-1 py-1" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full bg-current" />
      ))}
    </span>
  );
}
