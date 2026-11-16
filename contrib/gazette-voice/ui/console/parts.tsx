import type { ReactNode } from 'react';

export function Tile({ k, v, s, meter }: { k: string; v: string; s?: string; meter?: number }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{k}</div>
      <div className="text-2xl font-semibold tabular-nums">{v}</div>
      {s && <div className="text-xs text-muted-foreground">{s}</div>}
      {meter !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded bg-muted" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(meter * 100)} aria-label={k}>
          <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.round(meter * 100))}%` }} />
        </div>
      )}
    </div>
  );
}

const TONE: Record<string, string> = { ok: 'border-primary text-primary', done: 'border-primary text-primary', applied: 'border-primary text-primary', ready: 'border-primary text-primary',
  waiting: 'border-foreground/40 text-foreground', priced: 'border-foreground/40 text-foreground', running: 'border-foreground/40 text-foreground', regenerating: 'border-foreground/40 text-foreground',
  error: 'border-destructive text-destructive', failed: 'border-destructive text-destructive', refused: 'border-destructive text-destructive', rejected: 'border-muted-foreground text-muted-foreground', flagged: 'border-destructive text-destructive' };

export function Pill({ children, tone }: { children: ReactNode; tone: string }) {
  return <span className={`inline-block rounded-full border px-2 py-0.5 font-mono text-[0.7rem] font-semibold ${TONE[tone] ?? 'border-border text-muted-foreground'}`}>{children}</span>;
}

export function Problem({ text }: { text: string | null }) {
  if (!text) return null;
  return <p role="alert" className="rounded-md border border-destructive/50 p-2 text-sm text-destructive">{text}</p>;
}

export function Table({ head, rows, label }: { head: string[]; rows: ReactNode[][]; label: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm tabular-nums" aria-label={label}>
        <thead><tr>{head.map((h) => <th key={h} className="whitespace-nowrap bg-muted/40 px-3 py-2 text-start text-xs font-semibold text-muted-foreground">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-border">{r.map((c, j) => <td key={j} className="whitespace-nowrap px-3 py-2">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
