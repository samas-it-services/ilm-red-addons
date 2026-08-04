/**
 * ai-dataset-of-day body (design 1c — spec sheet). stats grid · explainer · link pills · "Papers in
 * our library" (job-written related_papers, section hidden when empty). AGENT_PROMPT §4.2.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ExternalLink, Download, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/I18nProvider';
import { LEARNING_TOKENS as TK } from '@/components/learning/tokens';
import { SectionHeading, StatCell, type BodyProps } from './parts';

export function DatasetBody({ row, payload }: BodyProps) {
  const { t } = useT('bookclubs');

  const stats = payload.stats && typeof payload.stats === 'object' ? payload.stats : null;
  const links = Array.isArray(payload.links) ? payload.links : [];
  const relatedPapers = Array.isArray(payload.related_papers) ? payload.related_papers : [];
  const hubStats = payload.hub_stats && typeof payload.hub_stats === 'object' ? payload.hub_stats : null;
  const explainer = row.explainer;

  // Plain stat cells — gold (--mastery) is reserved for the quiz result (REVIEW.md #5), so the
  // license value is no longer gold-tinted.
  const STAT_LABELS: [string, string][] = [
    ['tasks', t('dailyCard.dataset.tasks', { defaultValue: 'Tasks' })],
    ['released', t('dailyCard.dataset.released', { defaultValue: 'Released' })],
    ['modality', t('dailyCard.dataset.modality', { defaultValue: 'Modality' })],
    ['license', t('dailyCard.dataset.license', { defaultValue: 'License' })],
  ];

  return (
    <div className="space-y-4">
      {stats ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STAT_LABELS.filter(([k]) => typeof stats[k] === 'string').map(([k, label]) => (
            <StatCell key={k} label={label} value={stats[k]} />
          ))}
        </div>
      ) : null}

      {hubStats && (hubStats.downloads != null || hubStats.likes != null) ? (
        <HubStatsRow stats={hubStats} />
      ) : null}

      {explainer ? (
        <p className="max-w-[68ch] whitespace-pre-line text-[14px] leading-relaxed text-foreground/90" dir="auto">{explainer}</p>
      ) : null}

      {links.length ? (
        <div className="flex flex-wrap gap-2">
          {links.map((l: { label?: string; url?: string }, i: number) =>
            l.url && /^https:\/\//.test(l.url) ? (
              <a
                key={i}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-semibold',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  i === 0 ? 'text-primary' : 'border-border text-muted-foreground hover:text-foreground',
                )}
                style={i === 0 ? { borderColor: TK.primary } : undefined}
              >
                {l.label || l.url}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null,
          )}
        </div>
      ) : null}

      {relatedPapers.length ? (
        <div>
          <SectionHeading>
            {t('dailyCard.dataset.papers', { defaultValue: 'Papers in our library' })}
            <span className="ml-2 rounded-full bg-muted px-2 text-[11px] font-bold text-muted-foreground">{relatedPapers.length}</span>
          </SectionHeading>
          <div className="space-y-1.5">
            {relatedPapers.map((p: { book_id: string; title?: string; authors?: string; year?: number; note?: string }) => (
              <PaperRow key={p.book_id} paper={p} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Live hub popularity (job-written hub_stats). External, best-effort — the row simply omits when the
// enricher had nothing to show. Compact numbers, provider link, no gold (reserved for the quiz result).
function HubStatsRow({ stats }: { stats: { provider?: string; downloads?: number | null; likes?: number | null; url?: string } }) {
  const { t } = useT('bookclubs');
  const compact = (n?: number | null) =>
    typeof n === 'number' ? new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n) : null;
  const dl = compact(stats.downloads);
  const likes = compact(stats.likes);
  const label =
    stats.provider === 'huggingface'
      ? t('dailyCard.dataset.onHub', { defaultValue: 'On Hugging Face' })
      : t('dailyCard.dataset.onHubGeneric', { defaultValue: 'On the hub' });

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-border bg-muted/40 px-3 py-2 text-[12.5px] text-muted-foreground">
      <span className="font-semibold text-foreground/75">{label}</span>
      {dl ? (
        <span className="inline-flex items-center gap-1.5">
          <Download className="h-3.5 w-3.5" aria-hidden />
          <span className="font-semibold text-foreground">{dl}</span>
          {t('dailyCard.dataset.downloads', { defaultValue: 'downloads' })}
        </span>
      ) : null}
      {likes ? (
        <span className="inline-flex items-center gap-1.5">
          <Heart className="h-3.5 w-3.5" aria-hidden />
          <span className="font-semibold text-foreground">{likes}</span>
          {t('dailyCard.dataset.likes', { defaultValue: 'likes' })}
        </span>
      ) : null}
      {stats.url && /^https:\/\//.test(stats.url) ? (
        <a
          href={stats.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('dailyCard.dataset.viewOnHub', { defaultValue: 'View' })}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </div>
  );
}

function PaperRow({ paper }: { paper: { book_id: string; title?: string; authors?: string; year?: number; note?: string } }) {
  const { t } = useT('bookclubs');
  const [open, setOpen] = useState(false);
  const meta = [paper.authors, paper.year].filter(Boolean).join(' · ');
  return (
    <div className="rounded-xl border border-border bg-background">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold text-foreground" dir="auto">{paper.title || t('dailyCard.dataset.untitled', { defaultValue: 'Untitled' })}</div>
          {meta ? <div className="truncate text-[11.5px] text-muted-foreground" dir="auto">{meta}</div> : null}
        </div>
        {paper.note ? <ChevronDown className={cn('h-4 w-4 flex-none text-muted-foreground transition-transform', open && 'rotate-180')} /> : null}
      </button>
      {open && paper.note ? (
        <p className="max-w-[68ch] border-t border-border px-3 py-2 text-[12.5px] leading-relaxed text-muted-foreground" dir="auto">{paper.note}</p>
      ) : null}
      <div className="border-t border-border px-3 py-1.5">
        <Link to={`/books/${paper.book_id}`} className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline">
          {t('dailyCard.dataset.openPaper', { defaultValue: 'Open paper' })}
        </Link>
      </div>
    </div>
  );
}
