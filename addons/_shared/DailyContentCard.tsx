// "X of the Day" add-on SHELL — powers all six daily-content add-ons (task #296).
// One component, six configs. Renders only when the add-on is enabled for the club
// (useClubAddonEnabled), self-gating so it is harmless if mounted outside <AddonSlot>.
//
// After title/subtitle it dispatches on slug: the three AI slugs get a dedicated body
// (addons/daily/*), the three maths slugs keep the generic equation/puzzle/link body below.
// Content is produced server-side (nightly daily-cards pass + the daily-card-enrich job); this card
// is a read-only consumer of daily_cards.
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Brain, Database, Rocket, Sigma, Puzzle, GraduationCap, ExternalLink, Lightbulb, ChevronDown, ArrowRight,
} from 'lucide-react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { supabase } from '@/integrations/supabase/client';
import { useT } from '@/i18n/I18nProvider';
import { useClubAddonEnabled } from '@/hooks/useClubAddonEnabled';
import { AlgorithmBody } from './addons/daily/AlgorithmBody';
import { DatasetBody } from './addons/daily/DatasetBody';
import { StartupBody } from './addons/daily/StartupBody';
import type { BodyProps, DailyCardRow } from './addons/daily/parts';

type Kind = 'default' | 'equation' | 'puzzle';

// The three AI slugs get a dedicated body; the maths slugs fall through to the generic body.
const BODY: Record<string, React.FC<BodyProps>> = {
  'ai-algorithm-of-day': AlgorithmBody,
  'ai-dataset-of-day': DatasetBody,
  'ai-startup-of-day': StartupBody,
};

// Per-add-on presentation. `kind` drives the special generic rendering (KaTeX / puzzle reveal).
const CONFIG: Record<string, { kind: Kind; Icon: React.ComponentType<{ className?: string }>; nameKey: string; nameDefault: string }> = {
  'ai-algorithm-of-day':  { kind: 'default',  Icon: Brain,         nameKey: 'dailyCard.name.aiAlgorithm',   nameDefault: 'AI Algorithm of the Day' },
  'ai-dataset-of-day':    { kind: 'default',  Icon: Database,      nameKey: 'dailyCard.name.aiDataset',     nameDefault: 'AI Dataset of the Day' },
  'ai-startup-of-day':    { kind: 'default',  Icon: Rocket,        nameKey: 'dailyCard.name.aiStartup',     nameDefault: 'AI Startup of the Day' },
  'math-equation-of-day': { kind: 'equation', Icon: Sigma,         nameKey: 'dailyCard.name.mathEquation',  nameDefault: 'Math Equation of the Day' },
  'math-puzzle-of-day':   { kind: 'puzzle',   Icon: Puzzle,        nameKey: 'dailyCard.name.mathPuzzle',    nameDefault: 'Math Puzzle of the Day' },
  'mathematician-of-day': { kind: 'default',  Icon: GraduationCap, nameKey: 'dailyCard.name.mathematician', nameDefault: 'Mathematician of the Day' },
};

export const fmtDate = (d: string) => {
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return d; }
};

const Katex: React.FC<{ tex: string }> = ({ tex }) => {
  const html = useMemo(() => {
    try { return katex.renderToString(tex, { displayMode: true, throwOnError: false }); }
    catch { return null; }
  }, [tex]);
  if (!html) return <code className="text-[15px] text-foreground">{tex}</code>;
  return <div className="katex-daily overflow-x-auto py-1 text-foreground" dangerouslySetInnerHTML={{ __html: html }} />;
};

interface Props {
  clubId: string;
  slug: string;
}

export const DailyContentCard: React.FC<Props> = ({ clubId, slug }) => {
  const { t } = useT('bookclubs');
  const enabled = useClubAddonEnabled(clubId, slug);
  const [revealed, setRevealed] = useState(false);
  const cfg = CONFIG[slug];

  const { data, isLoading } = useQuery({
    queryKey: ['dailyCard', slug],
    enabled: enabled && !!cfg,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<DailyCardRow | null> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- daily_cards is not in gen:types yet
      const { data, error } = await (supabase as any)
        .from('daily_cards')
        .select('id, addon_slug, shown_date, title, subtitle, explainer, payload, source')
        .eq('addon_slug', slug)
        .order('shown_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as DailyCardRow) || null;
    },
  });

  if (!enabled || !cfg) return null;

  const { Icon, kind, nameKey, nameDefault } = cfg;
  const name = t(nameKey, { defaultValue: nameDefault });
  const row = data;
  const payload = row?.payload || {};
  const Body = BODY[slug];
  const latex = typeof payload.latex === 'string' ? payload.latex : null;
  const answer = typeof payload.answer === 'string' ? payload.answer : null;
  const solution = typeof payload.solution === 'string' ? payload.solution : null;
  const linkUrl = typeof payload.link_url === 'string' ? payload.link_url : null;
  const linkLabel = typeof payload.link_label === 'string' ? payload.link_label : linkUrl;

  return (
    <div data-testid={`daily-card-${slug}`} className="rounded-2xl border border-border bg-card p-5">
      {/* Add-on name + icon (17px) as a quiet kicker, date opposite it — the 24px item title below is
          the brightest thing on the card. Reading order: title → explainer → name → date (REVIEW.md #3). */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-foreground/75" />
          <h3 className="font-georgia text-[17px] text-foreground">{name}</h3>
        </div>
        {row ? (
          <span className="flex-none text-[11px] font-semibold uppercase tracking-[0.06em] text-foreground/75">
            {fmtDate(row.shown_date)}
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <p className="mt-3 rounded-xl border border-border bg-muted/40 p-6 text-center text-[13px] text-muted-foreground">
          {t('dailyCard.loading', { defaultValue: 'Loading today’s pick…' })}
        </p>
      ) : !row ? (
        <p data-testid={`daily-card-empty-${slug}`} className="mt-3 rounded-xl border border-border bg-muted/40 p-6 text-center text-[13px] text-muted-foreground">
          {t('dailyCard.empty', { defaultValue: 'Nothing yet — the daily pick refreshes overnight. Check back soon.' })}
        </p>
      ) : (
        <>
          <h4 className="font-georgia text-[24px] leading-tight text-foreground" dir="auto">{row.title}</h4>
          {row.subtitle && <p className="mt-0.5 text-[12.5px] text-muted-foreground" dir="auto">{row.subtitle}</p>}

          {Body ? (
            <div className="mt-4">
              <Body row={row} payload={payload} />
              <div className="mt-4 border-t border-border pt-3">
                <Link
                  to={`/clubs/${clubId}/daily/${slug}`}
                  className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary hover:underline"
                >
                  {t('dailyCard.fullPage', { defaultValue: 'See the full card' })}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <>
              {kind === 'equation' && latex && (
                <div className="mt-3 rounded-xl border border-border bg-background px-3 py-2">
                  <Katex tex={latex} />
                </div>
              )}

              {/* For a puzzle the explainer IS the question; otherwise it is the explainer prose. */}
              {row.explainer && (
                <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-foreground/90" dir="auto">
                  {row.explainer}
                </p>
              )}

              {kind === 'puzzle' && (answer || solution) && (
                <div className="mt-3">
                  {!revealed ? (
                    <button
                      type="button"
                      onClick={() => setRevealed(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[13px] font-semibold text-primary hover:bg-muted"
                    >
                      <Lightbulb className="h-3.5 w-3.5" />
                      {t('dailyCard.reveal', { defaultValue: 'Reveal solution' })}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <div className="rounded-xl border border-border bg-muted/40 p-3">
                      {answer && (
                        <p className="text-[14px] text-foreground" dir="auto">
                          <span className="font-semibold">{t('dailyCard.answer', { defaultValue: 'Answer' })}: </span>{answer}
                        </p>
                      )}
                      {solution && (
                        <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground" dir="auto">
                          <span className="font-semibold text-foreground">{t('dailyCard.solution', { defaultValue: 'Solution' })}: </span>{solution}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {kind !== 'puzzle' && linkUrl && (
                <a
                  href={linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />{linkLabel}
                </a>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default DailyContentCard;
