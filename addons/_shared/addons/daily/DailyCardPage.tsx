/**
 * Full daily-card page (design 1g). Route /clubs/:slug/daily/:addonSlug. 404 unless the club has that
 * add-on enabled. Two columns: main = the card body expanded; sidebar = a month archive grid (one
 * cell per day, today accented) with prev/next-day navigation. Read-only over daily_cards.
 *
 * Deferred (noted in SHIP_NOTES): the sidebar's "related terms" and the club-talk excerpt from 1g —
 * both need surfaces outside this add-on's data and are not built in this pass.
 */
import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useT } from '@/i18n/I18nProvider';
import { useClubAddonEnabled } from '@/hooks/useClubAddonEnabled';
import { useResolveClubId } from '@/hooks/useLearning';
import { LEARNING_TOKENS as TK } from '@/components/learning/tokens';
import { fmtDate } from '../../DailyContentCard';
import { AlgorithmBody } from './AlgorithmBody';
import { DatasetBody } from './DatasetBody';
import { StartupBody } from './StartupBody';
import type { BodyProps, DailyCardRow } from './parts';

const BODY: Record<string, React.FC<BodyProps>> = {
  'ai-algorithm-of-day': AlgorithmBody,
  'ai-dataset-of-day': DatasetBody,
  'ai-startup-of-day': StartupBody,
};
const NAME: Record<string, string> = {
  'ai-algorithm-of-day': 'AI Algorithm of the Day',
  'ai-dataset-of-day': 'AI Dataset of the Day',
  'ai-startup-of-day': 'AI Startup of the Day',
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const monthPrefix = (iso: string) => iso.slice(0, 7); // YYYY-MM

export default function DailyCardPage() {
  const { slug = '', addonSlug = '' } = useParams();
  const { t } = useT('bookclubs');
  const { data: clubId, isLoading: clubLoading } = useResolveClubId(slug);
  const enabled = useClubAddonEnabled(clubId ?? undefined, addonSlug);

  const [selected, setSelected] = useState<string | null>(null);

  // The month's rows (archive rail) — newest first.
  const { data: monthRows = [], isLoading } = useQuery({
    queryKey: ['dailyCardMonth', addonSlug],
    enabled: !!addonSlug && enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<DailyCardRow[]> => {
      const prefix = monthPrefix(todayIso());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- daily_cards not in gen:types
      const { data, error } = await (supabase as any)
        .from('daily_cards')
        .select('id, addon_slug, shown_date, title, subtitle, explainer, payload, source')
        .eq('addon_slug', addonSlug)
        .gte('shown_date', `${prefix}-01`)
        .order('shown_date', { ascending: false });
      if (error) throw error;
      return (data as DailyCardRow[]) || [];
    },
  });

  const dates = useMemo(() => monthRows.map((r) => r.shown_date), [monthRows]);
  const current = useMemo(() => {
    const want = selected ?? dates[0];
    return monthRows.find((r) => r.shown_date === want) ?? monthRows[0] ?? null;
  }, [monthRows, selected, dates]);

  if (clubLoading) {
    return <div className="mx-auto max-w-5xl px-4 py-16 text-center text-[13px] text-muted-foreground">{t('dailyCard.loading', { defaultValue: 'Loading today’s pick…' })}</div>;
  }
  // 404 gate: the club must resolve and have this add-on enabled.
  if (!clubId || enabled === false) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-georgia text-[26px] text-foreground">{t('dailyCard.notFound.title', { defaultValue: 'Not available here' })}</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">{t('dailyCard.notFound.body', { defaultValue: 'This club does not have this daily add-on enabled.' })}</p>
        <Link to={`/book-clubs/${slug}`} className="mt-5 inline-block text-[13px] font-semibold text-primary hover:underline">
          {t('dailyCard.notFound.back', { defaultValue: 'Back to the club' })}
        </Link>
      </div>
    );
  }

  const Body = BODY[addonSlug];
  const name = t(`dailyCard.name.${addonSlug}`, { defaultValue: NAME[addonSlug] ?? addonSlug });
  const idx = current ? dates.indexOf(current.shown_date) : -1;
  const olderExists = idx >= 0 && idx < dates.length - 1;   // dates are newest-first
  const newerExists = idx > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link to={`/book-clubs/${slug}`} className="text-[12.5px] font-semibold text-muted-foreground hover:text-foreground">
        ← {t('dailyCard.page.backToClub', { defaultValue: 'Back to the club' })}
      </Link>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <main className="min-w-0">
          {isLoading ? (
            <p className="rounded-2xl border border-border bg-card p-10 text-center text-[13px] text-muted-foreground">{t('dailyCard.loading', { defaultValue: 'Loading today’s pick…' })}</p>
          ) : !current ? (
            <p className="rounded-2xl border border-border bg-card p-10 text-center text-[13px] text-muted-foreground">{t('dailyCard.empty', { defaultValue: 'Nothing yet — the daily pick refreshes overnight. Check back soon.' })}</p>
          ) : (
            <article className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/75">{name} · {fmtDate(current.shown_date)}</p>
                <div className="flex items-center gap-1">
                  <button type="button" aria-label={t('dailyCard.page.prevDay', { defaultValue: 'Previous day' })} disabled={!olderExists}
                    onClick={() => olderExists && setSelected(dates[idx + 1])}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground disabled:opacity-40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label={t('dailyCard.page.nextDay', { defaultValue: 'Next day' })} disabled={!newerExists}
                    onClick={() => newerExists && setSelected(dates[idx - 1])}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground disabled:opacity-40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <h1 className="mt-2 font-georgia text-[26px] leading-tight text-foreground" dir="auto">{current.title}</h1>
              {current.subtitle ? <p className="mt-1 text-[14px] text-muted-foreground" dir="auto">{current.subtitle}</p> : null}

              <div className="mt-5">
                {Body ? <Body row={current} payload={current.payload || {}} /> : (
                  current.explainer ? <p className="max-w-[68ch] whitespace-pre-line text-[14px] leading-relaxed text-foreground/90" dir="auto">{current.explainer}</p> : null
                )}
              </div>
            </article>
          )}
        </main>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-foreground/75">{t('dailyCard.page.archive', { defaultValue: 'This month' })}</h2>
            {dates.length ? (
              <div className="grid grid-cols-5 gap-1.5">
                {monthRows.map((r) => {
                  const isToday = r.shown_date === todayIso();
                  const isSel = current?.shown_date === r.shown_date;
                  const day = Number(r.shown_date.slice(8, 10));
                  return (
                    <button key={r.id} type="button" onClick={() => setSelected(r.shown_date)}
                      aria-current={isSel ? 'true' : undefined}
                      title={fmtDate(r.shown_date)}
                      className={cn('flex h-9 items-center justify-center rounded-lg border text-[12px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isSel ? 'text-primary' : 'border-border text-muted-foreground hover:text-foreground')}
                      style={{
                        background: isSel ? TK.primarySoft : undefined,
                        borderColor: isToday && !isSel ? TK.primary : undefined,
                      }}>
                      {day}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-[12.5px] text-muted-foreground">{t('dailyCard.page.noArchive', { defaultValue: 'No entries yet this month.' })}</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
