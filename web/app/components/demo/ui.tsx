import type { ReactNode } from "react";
import type { Mastery, SourceType, Term } from "@/app/lib/demo/data";
import { Icon, type IconName } from "./icons";

const SOURCE: Record<SourceType, { label: string; icon: IconName; cls: string }> = {
  glossary: { label: "Glossary-verified", icon: "checkCircle", cls: "bg-ok-bg text-ok-ink" },
  retrieved: { label: "Retrieved from docs", icon: "doc", cls: "bg-info-bg text-info-ink" },
  ai: { label: "AI-generated, unverified", icon: "warning", cls: "bg-warn-bg text-warn-ink" },
};

export function SourceBadge({ source, small }: { source: SourceType; small?: boolean }) {
  const s = SOURCE[source];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold ${s.cls} ${small ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs"}`}
    >
      <Icon name={s.icon} size={small ? 12 : 14} />
      {s.label}
    </span>
  );
}

export function SourceLine({ term }: { term: Term }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SourceBadge source={term.source} />
      {term.approvedByYou && (
        <span className="inline-flex items-center gap-1 rounded-full bg-mint px-3 py-1 text-xs font-bold text-mint-ink">
          <Icon name="user" size={13} /> Approved by you
        </span>
      )}
      {term.citation && (
        <a
          href={term.citation.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex max-w-full items-center gap-1 text-xs font-semibold text-primary-text underline underline-offset-2"
        >
          <span className="truncate">Source: {term.citation.title}</span>
          <Icon name="external" size={12} />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
    </div>
  );
}

export function ShiftingFlag() {
  return (
    <span className="tip-wrap inline-flex">
      <span
        tabIndex={0}
        className="inline-flex items-center gap-1.5 rounded-full bg-sun px-3 py-1 text-xs font-bold text-sun-ink"
        aria-describedby="tip-shifting"
      >
        <Icon name="trending" size={14} /> Meaning shifting
      </span>
      <span role="tooltip" id="tip-shifting" className="tip">
        This term is changing fast. Definitions from even a year ago may be out of date.
      </span>
    </span>
  );
}

const MASTERY: Record<Mastery, { label: string; icon: IconName; cls: string }> = {
  new: { label: "New", icon: "plus", cls: "bg-peach text-peach-ink" },
  learning: { label: "Learning", icon: "repeat", cls: "bg-sun text-sun-ink" },
  mastered: { label: "Mastered", icon: "check", cls: "bg-mint text-mint-ink" },
};

export function MasteryChip({ mastery }: { mastery: Mastery }) {
  const m = MASTERY[mastery];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${m.cls}`}>
      <Icon name={m.icon} size={12} /> {m.label}
    </span>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{children}</p>;
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`clay p-5 sm:p-6 ${className}`}>{children}</section>;
}

export function EmptyState({ icon, title, body, children }: { icon: IconName; title: string; body: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <span className="clay-sm grid h-14 w-14 place-items-center text-primary-text">
        <Icon name={icon} size={26} />
      </span>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="max-w-sm text-sm text-muted">{body}</p>
      {children}
    </div>
  );
}

export function Notice({ tone, icon, children }: { tone: "warn" | "info" | "bad" | "ok"; icon: IconName; children: ReactNode }) {
  const cls = { warn: "bg-warn-bg text-warn-ink", info: "bg-info-bg text-info-ink", bad: "bg-bad-bg text-bad-ink", ok: "bg-ok-bg text-ok-ink" }[tone];
  return (
    <div className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium ${cls}`}>
      <Icon name={icon} size={18} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
