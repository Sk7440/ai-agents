"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { draftFor } from "@/app/lib/demo/data";
import { didYouMean, exactMatch, fuzzySearch } from "@/app/lib/demo/search";
import { useDemo, visibleTerms } from "@/app/lib/demo/store";
import { Icon, type IconName } from "./icons";
import { SourceBadge } from "./ui";

type Item =
  | { kind: "term"; id: string; label: string; sub: string }
  | { kind: "recent"; query: string }
  | { kind: "suggest"; id: string; label: string }
  | { kind: "draft"; query: string };

export function useSubmitSearch() {
  const { state, dispatch } = useDemo();
  return (raw: string) => {
    const q = raw.trim();
    if (!q) return;
    dispatch({ type: "recordSearch", query: q });
    const all = state.order.map((id) => state.terms[id]);
    const exact = exactMatch(all, q);
    if (exact) return dispatch({ type: "openTerm", id: exact.id, via: "search" });
    const vis = visibleTerms(state);
    const dym = didYouMean(vis, q);
    if (dym) return dispatch({ type: "didYouMean", query: q, suggestion: dym.id });
    const fuzzy = fuzzySearch(vis, q, 1)[0];
    if (fuzzy) return dispatch({ type: "openTerm", id: fuzzy.id, via: "search" });
    dispatch({ type: "startDraft", query: q, fields: draftFor(q) });
  };
}

export function SearchBox() {
  const { state } = useDemo();
  const submit = useSubmitSearch();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const all = state.order.map((id) => state.terms[id]);
  const vis = visibleTerms(state);
  const q = query.trim();

  const { items, hiddenCount } = useMemo(() => {
    const out: Item[] = [];
    if (!q) {
      state.recentSearches.forEach((r) => out.push({ kind: "recent", query: r }));
      return { items: out, hiddenCount: 0 };
    }
    const results = fuzzySearch(vis, q);
    const exact = exactMatch(all, q);
    const dym = !exact ? didYouMean(vis, q) : undefined;
    if (dym) out.push({ kind: "suggest", id: dym.id, label: dym.name });
    results
      .filter((t) => t.id !== dym?.id)
      .forEach((t) => out.push({ kind: "term", id: t.id, label: t.name, sub: t.audiences.beginner.oneLiner }));
    if (!exact && q.length >= 3) out.push({ kind: "draft", query: q });
    const hidden = state.safeMode ? fuzzySearch(all, q).filter((t) => t.source === "ai").length : 0;
    return { items: out, hiddenCount: hidden };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, state.recentSearches, state.safeMode, state.order]);

  // Press "/" anywhere to jump to search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const finish = () => {
    setOpen(false);
    setActive(-1);
    setQuery("");
    inputRef.current?.blur();
  };

  const activate = (item: Item) => {
    if (item.kind === "recent") submit(item.query);
    else if (item.kind === "draft") submit(item.query);
    else submit(state.terms[item.id].name);
    finish();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (items.length ? (a + 1) % items.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (items.length ? (a - 1 + items.length) % items.length : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && active >= 0 && items[active]) activate(items[active]);
      else if (q) {
        submit(q);
        finish();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  const optionId = (i: number) => `${listId}-opt-${i}`;
  const showList = open && (items.length > 0 || q.length > 0);

  return (
    <div ref={wrapRef} className="relative w-full">
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search AI terms
      </label>
      <div className="clay-in flex h-12 items-center gap-2 rounded-full px-4">
        <Icon name="search" size={18} className="shrink-0 text-muted" />
        <input
          ref={inputRef}
          id={`${listId}-input`}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? optionId(active) : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder="Search a term, e.g. RAG"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-ink outline-none placeholder:text-muted"
        />
        <kbd className="hidden rounded-md border border-line px-1.5 text-xs font-semibold text-muted md:inline">/</kbd>
      </div>

      {showList && (
        <div className="clay rise-in absolute left-0 right-0 top-[calc(100%+10px)] z-50 overflow-hidden p-2">
          {!q && items.length > 0 && <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wider text-muted">Recent searches</p>}
          <ul id={listId} role="listbox" aria-label="Search suggestions" className="max-h-[60vh] overflow-y-auto">
            {items.map((item, i) => {
              const selected = i === active;
              const base = `flex w-full cursor-pointer items-start gap-3 rounded-2xl px-3 py-2.5 text-left ${selected ? "bg-primary-soft" : "hover:bg-card-2"}`;
              let icon: IconName = "search";
              let body: React.ReactNode = null;
              if (item.kind === "recent") {
                icon = "history";
                body = <span className="font-semibold">{item.query}</span>;
              } else if (item.kind === "suggest") {
                icon = "bulb";
                body = (
                  <span>
                    Did you mean <strong className="text-primary-text">{item.label}</strong>?
                  </span>
                );
              } else if (item.kind === "term") {
                const t = state.terms[item.id];
                icon = "layers";
                body = (
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{item.label}</span>
                      <SourceBadge source={t.source} small />
                    </span>
                    <span className="mt-0.5 line-clamp-1 block text-sm text-muted">{item.sub}</span>
                  </span>
                );
              } else {
                icon = "spark";
                body = (
                  <span>
                    Draft a new entry for <strong>&ldquo;{item.query}&rdquo;</strong>
                    <span className="block text-xs text-muted">Not in the glossary yet · AI draft for your review · 1 credit</span>
                  </span>
                );
              }
              return (
                <li
                  key={i}
                  id={optionId(i)}
                  role="option"
                  aria-selected={selected}
                  className={base}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => activate(item)}
                  onMouseEnter={() => setActive(i)}
                >
                  <Icon name={icon} size={18} className="mt-0.5 shrink-0 text-primary-text" />
                  {body}
                </li>
              );
            })}
          </ul>
          {q && items.length === 0 && (
            <p className="px-3 py-3 text-sm text-muted">Keep typing. Press Enter to search.</p>
          )}
          {hiddenCount > 0 && (
            <p className="flex items-center gap-2 px-3 pb-2 pt-1 text-xs font-semibold text-muted">
              <Icon name="shield" size={14} /> {hiddenCount} AI-generated result hidden by Safe mode
            </p>
          )}
        </div>
      )}
    </div>
  );
}
