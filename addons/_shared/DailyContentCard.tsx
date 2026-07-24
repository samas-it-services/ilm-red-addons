// Reusable "X of the Day" add-on surface — powers all six daily-content add-ons (task #296):
//   AI algorithm / dataset / startup of the day, Math equation / puzzle / mathematician of the day.
// One component, six configs. Renders only when the add-on is enabled for the club
// (useClubAddonEnabled), self-gating so it is harmless if mounted outside <AddonSlot>.
//
// Content is produced server-side by the nightly `daily-cards` pass (scripts/learning-nightly.mjs):
// each day it picks one item from the curated daily_card_seeds bank (deterministic rotation) and
// upserts it into daily_cards (public-read). The explainer is a DeepSeek rephrase of the curated
// blurb where generative, and the curated blurb otherwise. This card just reads the latest row.
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Brain, Database, Rocket, Sigma, Puzzle, GraduationCap, ExternalLink, Lightbulb, ChevronDown,
} from 'lucide-react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { supabase } from '@/integrations/supabase/client';
import { useT } from '@/i18n/I18nProvider';
import { useClubAddonEnabled } from '@/hooks/useClubAddonEnabled';

type Kind = 'default' | 'equation' | 'puzzle';

interface CardRow {
  id: string;
  addon_slug: string;
  shown_date: string;
  title: string;
  subtitle: string | null;
  explainer: string | null;
  payload: Record<string, any> | null;
  source: string | null;
}

// Per-add-on presentation. `kind` drives the special rendering (KaTeX for equations, reveal for
// puzzles). `Icon` + `nameKey`/`nameDefault` head the card. Everything else is generic.
const CONFIG: Record<string, { kind: Kind; Icon: React.ComponentType<any>; nameKey: string; nameDefault: string }> = {
  'ai-algorithm-of-day':  { kind: 'default',  Icon: Brain,         nameKey: 'dailyCard.name.aiAlgorithm',   nameDefault: 'AI Algorithm of the Day' },
  'ai-dataset-of-day':    { kind: 'default',  Icon: Database,      nameKey: 'dailyCard.name.aiDataset',     nameDefault: 'AI Dataset of the Day' },
  'ai-startup-of-day':    { kind: 'default',  Icon: Rocket,        nameKey: 'dailyCard.name.aiStartup',     nameDefault: 'AI Startup of the Day' },
  'math-equation-of-day': { kind: 'equation', Icon: Sigma,         nameKey: 'dailyCard.name.mathEquation',  nameDefault: 'Math Equation of the Day' },
  'math-puzzle-of-day':   { kind: 'puzzle',   Icon: Puzzle,        nameKey: 'dailyCard.name.mathPuzzle',    nameDefault: 'Math Puzzle of the Day' },
  'mathematician-of-day': { kind: 'default',  Icon: GraduationCap, nameKey: 'dailyCard.name.mathematician', nameDefault: 'Mathematician of the Day' },
};

const fmtDate = (d: string) => {
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
    queryFn: async (): Promise<CardRow | null> => {
      const { data, error } = await (supabase as any)
        .from('daily_cards')
        .select('id, addon_slug, shown_date, title, subtitle, explainer, payload, source')
        .eq('addon_slug', slug)
        .order('shown_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as CardRow) || null;
    },
  });

  if (!enabled || !cfg) return null;

  const { Icon, kind, nameKey, nameDefault } = cfg;
  const name = t(nameKey, { defaultValue: nameDefault });
  const row = data;
  const payload = row?.payload || {};
  const latex = typeof payload.latex === 'string' ? payload.latex : null;
  const answer = typeof payload.answer === 'string' ? payload.answer : null;
  const solution = typeof payload.solution === 'string' ? payload.solution : null;
  const linkUrl = typeof payload.link_url === 'string' ? payload.link_url : null;
  const linkLabel = typeof payload.link_label === 'string' ? payload.link_label : linkUrl;

  return (
    <div data-testid={`daily-card-${slug}`} className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-georgia text-[17px] text-foreground">{name}</h3>
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
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {fmtDate(row.shown_date)}
          </p>

          <h4 className="font-georgia text-[19px] leading-tight text-foreground" dir="auto">{row.title}</h4>
          {row.subtitle && <p className="mt-0.5 text-[12.5px] text-muted-foreground" dir="auto">{row.subtitle}</p>}

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
    </div>
  );
};

export default DailyContentCard;
