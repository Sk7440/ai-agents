import type { Term } from "./data";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
    }
  }
  return prev[b.length];
}

function isSubsequence(q: string, s: string) {
  let i = 0;
  for (const c of s) if (c === q[i]) i++;
  return i === q.length;
}

const labels = (t: Term) => [t.name, t.fullName ?? "", ...t.aliases].filter(Boolean).map(norm);

/** Score a term against a query. Higher is better; 0 means no match. */
function scoreTerm(t: Term, q: string): number {
  let best = 0;
  for (const l of labels(t)) {
    if (l === q) best = Math.max(best, 100);
    else if (l.startsWith(q)) best = Math.max(best, 80 - (l.length - q.length) * 0.1);
    else if (l.split(" ").some((w) => w.startsWith(q))) best = Math.max(best, 65);
    else if (l.includes(q)) best = Math.max(best, 55);
    else if (q.length >= 2 && isSubsequence(q, l.replace(/ /g, ""))) best = Math.max(best, 35);
    else if (q.length >= 4) {
      const d = levenshtein(q, l.slice(0, Math.max(q.length, Math.min(l.length, q.length + 2))));
      if (d <= Math.floor(q.length / 4)) best = Math.max(best, 30 - d);
    }
  }
  return best;
}

export function fuzzySearch(terms: Term[], query: string, limit = 6) {
  const q = norm(query);
  if (!q) return [];
  return terms
    .map((t) => ({ term: t, score: scoreTerm(t, q) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.term);
}

export function exactMatch(terms: Term[], query: string) {
  const q = norm(query);
  return terms.find((t) => labels(t).includes(q));
}

/** "Did you mean" for typos: closest label within a small edit distance. */
export function didYouMean(terms: Term[], query: string): Term | undefined {
  const q = norm(query);
  if (q.length < 3) return undefined;
  let best: { t: Term; d: number } | undefined;
  for (const t of terms) {
    for (const l of labels(t)) {
      const d = levenshtein(q, l);
      const allowed = Math.max(1, Math.round(l.length * 0.3));
      if (d > 0 && d <= allowed && (!best || d < best.d)) best = { t, d };
    }
  }
  return best?.t;
}

export type Segment = { text: string; termId?: string };

/** Split text into plain and recognised-term segments (longest label wins). */
export function findTermsInText(terms: Term[], text: string): Segment[] {
  const entries = terms
    .flatMap((t) => [t.name, t.fullName ?? "", ...t.aliases].filter((l) => l.length > 2).map((l) => ({ l, id: t.id })))
    // "context" and "reasoning" alone are too generic to highlight in free text
    .filter((e) => !["context", "reasoning", "cot", "model"].includes(e.l.toLowerCase()))
    .sort((a, b) => b.l.length - a.l.length);
  const escaped = entries.map((e) => e.l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[- ]/g, "[- ]?"));
  // Also matches simple plurals: "language models", "agents".
  const re = new RegExp(`\\b(${escaped.join("|")})(?:s|es)?\\b`, "gi");
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    const found = norm(m[1]).replace(/ /g, "");
    const entry = entries.find((e) => norm(e.l).replace(/ /g, "") === found);
    if (!entry) continue;
    if (idx > last) out.push({ text: text.slice(last, idx) });
    out.push({ text: m[0], termId: entry.id });
    last = idx + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
