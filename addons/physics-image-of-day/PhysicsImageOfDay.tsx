// Physics Image of the Day add-on (built-in surface) — Overview section of a club.
// Renders only when the 'physics-image-of-day' add-on is enabled for the club (useClubAddonEnabled).
//
// Shows TODAY's images from every source together (newest row per source — the sources publish on
// different cadences: NASA daily, ESO weekly, ESA/Hubble monthly), plus an Embla carousel to browse
// PAST days grouped by date. Every image keeps its source credit and a link to the original page
// (licensing: NASA public domain but still credited; ESO + ESA/Hubble are CC BY 4.0).
//
// Data is fetched server-side (scripts/learning-nightly.mjs `image-of-day` pass) into image_of_day,
// which is public-read — these are public science images, so no auth is required to view them.
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Telescope, ExternalLink, ImageOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useT } from '@/i18n/I18nProvider';
import { useClubAddonEnabled } from '@/hooks/useClubAddonEnabled';
import {
  Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext,
} from '@/components/ui/carousel';

const ADDON_SLUG = 'physics-image-of-day';

interface ImageRow {
  id: string;
  source: string;
  published_date: string;
  title: string;
  image_url: string;
  thumb_url: string | null;
  credit: string | null;
  source_url: string | null;
  description: string | null;
  media_type: string | null;
}

interface Props {
  clubId: string;
}

const fmtDate = (d: string) => {
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return d;
  }
};

export const PhysicsImageOfDay: React.FC<Props> = ({ clubId }) => {
  const { t } = useT('bookclubs');
  const enabled = useClubAddonEnabled(clubId, ADDON_SLUG);

  const { data, isLoading } = useQuery({
    queryKey: ['imageOfDay'],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ImageRow[]> => {
      const { data, error } = await (supabase as any)
        .from('image_of_day')
        .select('id, source, published_date, title, image_url, thumb_url, credit, source_url, description, media_type')
        .order('published_date', { ascending: false })
        .limit(120);
      if (error) throw error;
      return (data || []) as ImageRow[];
    },
  });

  const rows = data || [];

  // Newest row per source = the "today across the sky" set.
  const latestPerSource = useMemo(() => {
    const seen = new Set<string>();
    const out: ImageRow[] = [];
    for (const r of rows) {
      if (seen.has(r.source)) continue;
      seen.add(r.source);
      out.push(r);
    }
    return out;
  }, [rows]);

  // Past days = distinct dates (desc), each grouping that date's images. Excludes only the single
  // most-recent date so "Today" and the first carousel slide aren't identical.
  const pastDays = useMemo(() => {
    const byDate = new Map<string, ImageRow[]>();
    for (const r of rows) {
      const arr = byDate.get(r.published_date) || [];
      arr.push(r);
      byDate.set(r.published_date, arr);
    }
    const dates = [...byDate.keys()].sort((a, b) => (a < b ? 1 : -1));
    return dates.slice(1).map((d) => ({ date: d, items: byDate.get(d)! }));
  }, [rows]);

  if (!enabled) return null;

  const Thumb = ({ row, className }: { row: ImageRow; className?: string }) => (
    <div className={`relative overflow-hidden rounded-xl bg-muted ${className || ''}`}>
      {row.image_url ? (
        <img
          src={row.thumb_url || row.image_url}
          alt={row.title}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <ImageOff className="h-6 w-6" />
        </div>
      )}
      {row.media_type === 'video' && (
        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
          {t('physicsImage.video', { defaultValue: 'Video' })}
        </span>
      )}
    </div>
  );

  const SourceTag = ({ source }: { source: string }) => (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{source}</span>
  );

  const TodayCard = ({ row }: { row: ImageRow }) => (
    <div data-testid={`physics-image-${row.source}`} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <Thumb row={row} className="aspect-[4/3]" />
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <SourceTag source={row.source} />
          <span className="text-[11px] text-muted-foreground">{fmtDate(row.published_date)}</span>
        </div>
        <h5 className="font-georgia text-[15px] leading-snug text-foreground" dir="auto">{row.title}</h5>
        {row.credit && (
          <p className="text-[11.5px] text-muted-foreground" dir="auto">
            <span className="font-semibold">{t('physicsImage.credit', { defaultValue: 'Credit' })}: </span>{row.credit}
          </p>
        )}
        {row.source_url && (
          <a
            href={row.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex items-center gap-1 pt-1 text-[12px] font-semibold text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />{t('physicsImage.viewSource', { defaultValue: 'View original' })}
          </a>
        )}
      </div>
    </div>
  );

  return (
    <div data-testid="physics-image-of-day" className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <Telescope className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-georgia text-[17px] text-foreground">{t('physicsImage.title', { defaultValue: 'Physics Image of the Day' })}</h3>
      </div>
      <p className="mb-4 text-[13px] text-muted-foreground" dir="auto">
        {t('physicsImage.subtitle', { defaultValue: 'Today across the sky — from NASA, ESO and ESA/Hubble.' })}
      </p>

      {isLoading ? (
        <p className="rounded-xl border border-border bg-muted/40 p-6 text-center text-[13px] text-muted-foreground">
          {t('physicsImage.loading', { defaultValue: "Fetching today's images…" })}
        </p>
      ) : latestPerSource.length === 0 ? (
        <p data-testid="physics-image-empty" className="rounded-xl border border-border bg-muted/40 p-6 text-center text-[13px] text-muted-foreground">
          {t('physicsImage.empty', { defaultValue: 'No images yet — the daily fetch runs overnight. Check back soon.' })}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {latestPerSource.map((row) => <TodayCard key={row.id} row={row} />)}
          </div>

          {pastDays.length > 0 && (
            <div className="mt-6">
              <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                {t('physicsImage.past', { defaultValue: 'Browse past days' })}
              </h4>
              <Carousel opts={{ align: 'start', dragFree: true }} className="w-full">
                <CarouselContent className="-ml-3">
                  {pastDays.map(({ date, items }) => (
                    <CarouselItem key={date} className="basis-[80%] pl-3 sm:basis-1/2 lg:basis-1/3">
                      <div className="rounded-2xl border border-border bg-background p-3">
                        <p className="mb-2 text-[12px] font-semibold text-foreground">{fmtDate(date)}</p>
                        <div className="space-y-2">
                          {items.map((row) => (
                            <a
                              key={row.id}
                              href={row.source_url || row.image_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group flex items-center gap-2.5"
                            >
                              <Thumb row={row} className="h-12 w-16 flex-none" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[12.5px] font-medium text-foreground group-hover:underline" dir="auto">{row.title}</span>
                                <span className="block truncate text-[11px] text-muted-foreground">{row.source}{row.credit ? ` · ${row.credit}` : ''}</span>
                              </span>
                            </a>
                          ))}
                        </div>
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="hidden sm:flex" />
                <CarouselNext className="hidden sm:flex" />
              </Carousel>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PhysicsImageOfDay;
