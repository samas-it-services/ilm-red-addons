/**
 * Small shared pieces for the daily-card bodies. Tokens only, no hex (SIDEBAR/daily theme rule):
 * gold chips use `--mastery`, everything else uses semantic classes.
 */
import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LEARNING_TOKENS as TK } from '@/components/learning/tokens';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- daily_cards.payload is dynamic JSON
export type CardPayload = Record<string, any>;

export interface DailyCardRow {
  id: string;
  addon_slug: string;
  shown_date: string;
  title: string;
  subtitle: string | null;
  explainer: string | null;
  payload: CardPayload | null;
  source: string | null;
}

export interface BodyProps {
  row: DailyCardRow;
  payload: CardPayload;
}

export function Chip({ children, gold }: { children: React.ReactNode; gold?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold',
        gold ? '' : 'bg-muted text-muted-foreground',
      )}
      style={gold ? { color: TK.mastery, background: TK.masterySoft } : undefined}
    >
      {children}
    </span>
  );
}

// Small tracked uppercase labels (9.5–11px) sit at the contrast floor with text-muted-foreground
// (REVIEW.md blocker 2); brightened to text-foreground/75 (~6.8:1). 12.5px+ subtitles keep muted.
export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h5 className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-foreground/75">{children}</h5>
  );
}

/** A cell in a stat grid: small brightened label over a value. `gold` tints the value with --mastery. */
export function StatCell({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2.5">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-foreground/75" dir="auto">{label}</div>
      <div className="mt-0.5 text-[13.5px] font-semibold text-foreground" dir="auto" style={gold ? { color: TK.mastery } : undefined}>{value}</div>
    </div>
  );
}

export function CopyButton({ text, label, copiedLabel }: { text: string; label: string; copiedLabel: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard unavailable */ }
      }}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? copiedLabel : label}
    </button>
  );
}
