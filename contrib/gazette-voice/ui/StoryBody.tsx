import { Fragment, useId, useState, type ReactNode } from 'react';
import { useSdk } from '../../_sdk/react';
import { useStrings } from './useStrings';
import type { NewsroomTerm, TermPrefs, Level } from './types';

const LINK = /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g;

/** Underline style per level, so colour is never the only cue (solid, dashed, dotted). */
export const LEVEL_CLASS: Record<Level, string> = {
  easy: 'border-b-2 border-solid border-primary',
  advanced: 'border-b-2 border-dashed border-primary',
  expert: 'border-b-2 border-dotted border-primary',
};

type Piece = { kind: 'text'; text: string } | { kind: 'link'; text: string; url: string } | { kind: 'term'; text: string; term: NewsroomTerm };

/** Splits the body into text, links and terms. Terms never overlap links (the pipeline guarantees it). */
export function pieces(body: string, terms: NewsroomTerm[]): Piece[] {
  const marks: Array<{ start: number; end: number; piece: Piece }> = [];
  for (const m of body.matchAll(LINK)) marks.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, piece: { kind: 'link', text: m[1], url: m[2] } });
  for (const t of terms) {
    if (t.start < 0 || t.end > body.length || t.end <= t.start) continue;
    if (marks.some((k) => t.start < k.end && t.end > k.start)) continue;
    marks.push({ start: t.start, end: t.end, piece: { kind: 'term', text: body.slice(t.start, t.end), term: t } });
  }
  marks.sort((a, b) => a.start - b.start);
  const out: Piece[] = [];
  let at = 0;
  for (const k of marks) {
    if (k.start > at) out.push({ kind: 'text', text: body.slice(at, k.start) });
    out.push(k.piece);
    at = k.end;
  }
  if (at < body.length) out.push({ kind: 'text', text: body.slice(at) });
  return out;
}

function Term({ term, clubSlug, on }: { term: NewsroomTerm; clubSlug: string; on: boolean }) {
  const { href, lang } = useSdk();
  const ur = lang === 'ur';
  const s = useStrings();
  const [open, setOpen] = useState(false);
  const tipId = useId();
  const text = term.name;
  if (!on) return <>{text}</>;
  const label = s(`level.${term.level}` as const);
  return (
    <span className="relative inline">
      <a
        href={href.term(clubSlug, term.slug)}
        data-level={term.level}
        className={`rounded-sm bg-muted px-0.5 text-foreground no-underline hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${ur ? 'pb-1' : ''} ${LEVEL_CLASS[term.level]}`}
        aria-describedby={open ? tipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {text}
        {/* Urdu: the tag would crowd the Nastaliq letters, so the level is read out and shown in the card instead. */}
        <sup className={ur ? 'sr-only' : 'ms-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground'}>{label}</sup>
      </a>
      {open && (
        <span id={tipId} role="tooltip" className="absolute start-0 top-full z-20 mt-1 block w-72 rounded-md border border-border bg-popover p-2 text-start text-sm text-popover-foreground shadow-md">
          <b className="font-semibold">{term.name}</b>
          <span className="ms-2 font-mono text-[0.65rem] uppercase text-muted-foreground">{label}</span>
          <span className="mt-1 block">{term.hook ?? s('term.noHook')}</span>
          <span className="mt-1 block text-primary">{s('term.open')}</span>
        </span>
      )}
    </span>
  );
}

/** A story body: inline links open in a new tab; terms are highlighted or plain text per the reader's settings. */
export function StoryBody({ body, terms, clubSlug, prefs }: { body: string; terms: NewsroomTerm[]; clubSlug: string; prefs: TermPrefs }): ReactNode {
  return (
    <p className="max-w-prose leading-relaxed">
      {pieces(body, terms).map((p, i) => {
        if (p.kind === 'text') return <Fragment key={i}>{p.text}</Fragment>;
        if (p.kind === 'link') return <a key={i} href={p.url} target="_blank" rel="nofollow ugc noopener noreferrer" className="text-primary underline underline-offset-2">{p.text}</a>;
        return <Term key={i} term={p.term} clubSlug={clubSlug} on={prefs.highlight && prefs.levels.includes(p.term.level)} />;
      })}
    </p>
  );
}
