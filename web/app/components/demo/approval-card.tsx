"use client";

import { useEffect, useState } from "react";
import type { DraftFields } from "@/app/lib/demo/data";
import { useStream } from "@/app/lib/demo/hooks";
import { badgeProgress, useDemo, type Draft } from "@/app/lib/demo/store";
import { Icon } from "./icons";
import { Eyebrow, Notice, SourceBadge } from "./ui";

const FIELDS: { key: keyof DraftFields; label: string; multiline?: boolean }[] = [
  { key: "oneLiner", label: "One-liner", multiline: true },
  { key: "mentalModel", label: "Mental model", multiline: true },
  { key: "example", label: "Real-world example", multiline: true },
  { key: "deeper", label: "Go deeper", multiline: true },
];

export function ApprovalCard({ draft }: { draft: Draft }) {
  const { state, dispatch } = useDemo();
  const [reveal, setReveal] = useState(false);
  const [edit, setEdit] = useState<DraftFields>(draft.fields);
  const stream = useStream(draft.fields.oneLiner, `draft-${draft.query}`, { retrieve: true, speed: 26 });
  const curator = badgeProgress(state, "curator");
  const f = draft.fields;

  useEffect(() => {
    if (draft.status === "drafting" && stream.phase === "done") dispatch({ type: "draftReady" });
  }, [draft.status, stream.phase, dispatch]);

  if (draft.status === "error") {
    return (
      <section className="clay p-6" role="alert">
        <Eyebrow>Couldn&apos;t draft &ldquo;{draft.query}&rdquo;</Eyebrow>
        <h2 className="mt-1 font-display text-2xl font-bold">Not enough credits</h2>
        <div className="mt-4">
          <Notice tone="bad" icon="coin">{draft.error}</Notice>
        </div>
        <button type="button" className="btn btn-soft mt-4" onClick={() => dispatch({ type: "draftReject" })}>
          Dismiss
        </button>
      </section>
    );
  }

  const hidden = state.safeMode && !reveal;
  const drafting = draft.status === "drafting";
  const editing = draft.status === "editing";

  return (
    <section className="clay overflow-hidden" aria-labelledby="draft-title">
      <div className="flex flex-col gap-3 bg-card-2 p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary-text">
            <Icon name="user" size={13} /> Needs your approval
          </span>
          <SourceBadge source="ai" />
        </div>
        <h2 id="draft-title" className="font-display text-3xl font-extrabold tracking-tight">{f.name}</h2>
        <p className="text-sm text-muted">
          &ldquo;{draft.query}&rdquo; isn&apos;t in the glossary yet. The agent drafted an entry. Nothing is added until you approve it.
        </p>
      </div>

      <div className="p-5 sm:p-7">
        {hidden ? (
          <div className="clay-in rounded-3xl p-5">
            <Notice tone="warn" icon="shield">
              Safe mode hides AI-generated drafts. You can still review this one, since approving it is how it gets verified.
            </Notice>
            <button type="button" className="btn btn-soft mt-4" onClick={() => setReveal(true)}>Review the draft</button>
          </div>
        ) : editing ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              dispatch({ type: "draftSave", fields: edit });
            }}
          >
            <Field label="Term name" value={edit.name} onChange={(v) => setEdit({ ...edit, name: v })} />
            {FIELDS.map((fl) => (
              <Field key={fl.key} label={fl.label} multiline value={edit[fl.key]} onChange={(v) => setEdit({ ...edit, [fl.key]: v })} />
            ))}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Proposed source title" value={edit.sourceTitle} onChange={(v) => setEdit({ ...edit, sourceTitle: v })} />
              <Field label="Proposed source URL" value={edit.sourceUrl} onChange={(v) => setEdit({ ...edit, sourceUrl: v })} />
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="submit" className="btn btn-primary" disabled={!edit.name.trim() || !edit.oneLiner.trim()}>
                <Icon name="check" size={17} /> Save changes
              </button>
              <button type="button" className="btn btn-soft" onClick={() => { setEdit(f); dispatch({ type: "draftSave", fields: f }); }}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-primary-text" aria-live="polite">
                {stream.phase === "retrieving" && (
                  <span className="inline-flex items-center gap-2">
                    <span className="dots inline-flex gap-1" aria-hidden="true"><span /><span /><span /></span>
                    Searching the glossary and docs… no match. Drafting entry
                  </span>
                )}
                {stream.phase === "writing" && <span className="inline-flex items-center gap-2"><Icon name="edit" size={13} /> Writing draft…</span>}
                {stream.phase === "stopped" && "Stopped"}
              </p>
              {stream.streaming && (
                <button type="button" onClick={stream.stop} className="btn btn-soft !min-h-[36px] !px-3 !text-xs">
                  <Icon name="stop" size={13} /> Stop
                </button>
              )}
              {stream.phase === "stopped" && drafting && (
                <button type="button" onClick={stream.finish} className="btn btn-ghost !min-h-[36px] !px-3 !text-sm">
                  Show the full draft
                </button>
              )}
            </div>

            <div className="clay-in rounded-3xl p-5" aria-live="polite" aria-busy={stream.streaming}>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">One-liner</p>
              {stream.phase === "retrieving" ? (
                <div className="mt-3 space-y-2.5" aria-hidden="true">
                  <div className="shimmer h-4 w-11/12 rounded-full" />
                  <div className="shimmer h-4 w-8/12 rounded-full" />
                </div>
              ) : (
                <p className={`mt-1.5 font-display text-lg font-semibold leading-relaxed ${stream.phase === "writing" ? "caret" : ""}`}>
                  {drafting ? stream.shown : f.oneLiner}
                </p>
              )}
            </div>

            {!drafting && (
              <div className="rise-in space-y-3">
                {FIELDS.slice(1).map((fl) => (
                  <div key={fl.key} className="rounded-3xl bg-card-2 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{fl.label}</p>
                    <p className="mt-1 text-[15px] leading-relaxed">{f[fl.key]}</p>
                  </div>
                ))}
                <div className="flex items-start gap-2 rounded-3xl bg-info-bg p-4 text-sm text-info-ink">
                  <Icon name="doc" size={17} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold">Proposed source</p>
                    {f.sourceUrl ? (
                      <a href={f.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">
                        {f.sourceTitle}<span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    ) : (
                      <p>{f.sourceTitle}. Add one before approving if you can.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2.5">
                <button type="button" className="btn btn-primary" disabled={drafting} onClick={() => dispatch({ type: "draftApprove" })}>
                  <Icon name="check" size={17} /> Approve
                </button>
                <button type="button" className="btn btn-soft" disabled={drafting} onClick={() => { setEdit(f); dispatch({ type: "draftEdit" }); }}>
                  <Icon name="edit" size={17} /> Edit
                </button>
                <button type="button" className="btn btn-soft text-bad-ink" disabled={drafting} onClick={() => dispatch({ type: "draftReject" })}>
                  <Icon name="x" size={17} /> Reject
                </button>
              </div>
              <div className="min-w-[180px]">
                <p className="flex items-center gap-1.5 text-xs font-bold text-muted">
                  <Icon name="shield" size={14} /> Curator badge · {curator.value}/{curator.goal} approved
                </p>
                <div className="clay-in mt-1.5 h-2.5 overflow-hidden rounded-full" role="progressbar" aria-label="Curator badge progress" aria-valuemin={0} aria-valuemax={curator.goal} aria-valuenow={curator.value}>
                  <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${(curator.value / curator.goal) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Field({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  const cls = "clay-in mt-1.5 w-full rounded-2xl px-4 py-3 text-[15px] text-ink outline-none focus-visible:outline-[3px] focus-visible:outline-[var(--focus)]";
  return (
    <label className="block text-sm font-bold text-muted">
      {label}
      {multiline ? (
        <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} className={`${cls} resize-y`} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </label>
  );
}
