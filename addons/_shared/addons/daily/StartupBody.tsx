/**
 * ai-startup-of-day body. listing.status 'private' → design 1e (tabs); 'public' → 1f (ticker panel).
 * The client is a read-only consumer of daily_cards; `market` is job-written. No price prediction,
 * no financial claim without the fixed disclaimer. AGENT_PROMPT §4.3.
 */
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/I18nProvider';
import { LEARNING_TOKENS as TK } from '@/components/learning/tokens';
import { DailyTabs, type DailyTab } from './DailyTabs';
import { Chip, SectionHeading, StatCell, type BodyProps } from './parts';

const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return d; }
};

export function StartupBody({ row, payload }: BodyProps) {
  const { t } = useT('bookclubs');

  const listing = payload.listing && typeof payload.listing === 'object' ? payload.listing : null;
  const isPublic = listing?.status === 'public';
  const logo = typeof payload.logo_url === 'string' && /^https:\/\//.test(payload.logo_url) ? payload.logo_url : null;
  const metaLine = [payload.hq, payload.founded].filter((x) => typeof x === 'string').join(' · ');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Logo url={logo} name={row.title} />
        <div className="min-w-0">
          {metaLine ? <div className="text-[12.5px] text-muted-foreground" dir="auto">{metaLine}</div> : null}
          {isPublic && listing?.ticker ? (
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {listing.exchange ? `${listing.exchange}: ` : ''}{listing.ticker}
            </div>
          ) : (
            <Chip>{t('dailyCard.startup.private', { defaultValue: 'Private' })}</Chip>
          )}
        </div>
      </div>

      {isPublic ? <PublicBody payload={payload} /> : <PrivateBody payload={payload} />}
    </div>
  );
}

function Logo({ url, name }: { url: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  if (url && !broken) {
    return <img src={url} alt="" onError={() => setBroken(true)} className="h-14 w-14 flex-none rounded-xl border border-border object-contain" />;
  }
  return (
    <div className="flex h-14 w-14 flex-none items-center justify-center rounded-xl border border-dashed border-border text-[18px] font-bold text-muted-foreground" aria-hidden="true">
      {name?.charAt(0)?.toUpperCase() ?? '·'}
    </div>
  );
}

/* ── Private (1e) ────────────────────────────────────────────────────────────────────────────── */
function PrivateBody({ payload }: { payload: Record<string, unknown> }) {
  const { t } = useT('bookclubs');
  const funding = Array.isArray(payload.funding) ? (payload.funding as Record<string, unknown>[]).filter((f) => typeof f.source_url === 'string') : [];
  const products = Array.isArray(payload.products) ? (payload.products as Record<string, unknown>[]) : [];
  const street = payload.street_view && typeof payload.street_view === 'object' ? payload.street_view as Record<string, unknown> : null;
  const headcount = typeof payload.headcount === 'string' ? payload.headcount : null;

  const tabs: DailyTab[] = [];

  tabs.push({
    key: 'market',
    label: t('dailyCard.startup.market', { defaultValue: 'Market' }),
    render: () => (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {typeof (funding[0]?.valuation) === 'string' ? <StatCell label={t('dailyCard.startup.valuation', { defaultValue: 'Valuation' })} value={funding[0].valuation as string} /> : null}
          {funding.length ? <StatCell label={t('dailyCard.startup.raised', { defaultValue: 'Rounds' })} value={String(funding.length)} /> : null}
          {headcount ? <StatCell label={t('dailyCard.startup.headcount', { defaultValue: 'Headcount' })} value={headcount} /> : null}
        </div>
        {street && typeof street.body === 'string' ? (
          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <SectionHeading>{t('dailyCard.startup.street', { defaultValue: "The Street's read" })}</SectionHeading>
            <p className="max-w-[68ch] text-[13px] leading-relaxed text-muted-foreground" dir="auto">{street.body as string}</p>
            {typeof street.as_of === 'string' ? <p className="mt-1 text-[11px] text-muted-foreground/80">{fmtDate(street.as_of as string)}</p> : null}
          </div>
        ) : null}
      </div>
    ),
  });

  if (funding.length) {
    tabs.push({
      key: 'funding',
      label: t('dailyCard.startup.funding', { defaultValue: 'Funding' }),
      render: () => (
        <ol className="space-y-2">
          {funding.map((f, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2">
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-foreground" dir="auto">{String(f.round ?? '')} {f.year ? `· ${f.year}` : ''}</div>
                {typeof f.valuation === 'string' ? <div className="text-[11.5px] text-muted-foreground">{t('dailyCard.startup.valuation', { defaultValue: 'Valuation' })}: {f.valuation}</div> : null}
              </div>
              <div className="flex-none text-[13.5px] font-semibold text-foreground">{String(f.amount ?? '')}</div>
            </li>
          ))}
        </ol>
      ),
    });
  }

  if (products.length) {
    tabs.push({
      key: 'products',
      label: t('dailyCard.startup.products', { defaultValue: 'What they ship' }),
      render: () => (
        <div className="space-y-2">
          {products.map((p, i) => (
            <div key={i} className="rounded-xl border border-border bg-background px-3 py-2">
              {typeof p.name === 'string' ? <div className="text-[13.5px] font-semibold text-foreground" dir="auto">{p.name}</div> : null}
              {typeof p.body === 'string' ? <div className="text-[12.5px] leading-relaxed text-muted-foreground" dir="auto">{p.body}</div> : null}
            </div>
          ))}
        </div>
      ),
    });
  }

  return <DailyTabs tabs={tabs} ariaLabel={t('dailyCard.startup.tabs', { defaultValue: 'Startup sections' })} />;
}

/* ── Public (1f) ─────────────────────────────────────────────────────────────────────────────── */
function PublicBody({ payload }: { payload: Record<string, unknown> }) {
  const { t } = useT('bookclubs');
  const market = payload.market && typeof payload.market === 'object' ? payload.market as Record<string, unknown> : null;
  const ok = market?.status === 'ok';

  if (!ok) {
    return (
      <p className="rounded-xl border border-border bg-muted/40 p-3 text-[13px] text-muted-foreground" dir="auto">
        {t('dailyCard.startup.quoteUnavailable', { defaultValue: 'Live quote unavailable — showing the profile only.' })}
      </p>
    );
  }

  const price = market.price as number;
  const currency = (market.currency as string) || 'USD';
  const change = Number(market.change_pct ?? 0);
  const up = change >= 0;
  const spark = Array.isArray(market.spark) ? (market.spark as number[]) : [];
  const analyst = market.analyst && typeof market.analyst === 'object' ? market.analyst as Record<string, number> : null;
  const disclaimer = t('dailyCard.startup.disclaimer', {
    provider: String(market.provider ?? ''),
    as_of: fmtDate(String(market.as_of ?? '')),
    defaultValue: `Quotes delayed. Sample of ${String(market.provider ?? '')} data as of ${fmtDate(String(market.as_of ?? ''))}. Not investment advice.`,
  });

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <div className="text-[24px] font-bold text-foreground tabular-nums">{price?.toLocaleString(undefined, { style: 'currency', currency })}</div>
        <div className={cn('pb-1 text-[13.5px] font-semibold tabular-nums', up ? 'text-success' : 'text-destructive')}>
          {up ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
        </div>
      </div>

      {spark.length >= 2 ? <Sparkline data={spark} up={up} label={t('dailyCard.startup.sparkLabel', { count: spark.length, defaultValue: `${spark.length}-point recent trend, ${up ? 'up' : 'down'} ${Math.abs(change).toFixed(1)}%` })} /> : null}

      <div className="grid grid-cols-2 gap-2">
        {typeof market.low_52w === 'number' ? <StatCell label={t('dailyCard.startup.low52', { defaultValue: '52-week low' })} value={(market.low_52w as number).toLocaleString(undefined, { style: 'currency', currency })} /> : null}
        {typeof market.high_52w === 'number' ? <StatCell label={t('dailyCard.startup.high52', { defaultValue: '52-week high' })} value={(market.high_52w as number).toLocaleString(undefined, { style: 'currency', currency })} /> : null}
      </div>

      {analyst ? <AnalystBar analyst={analyst} currency={currency} /> : null}

      <p className="max-w-[68ch] text-[11px] leading-relaxed text-muted-foreground/80" dir="auto">{disclaimer}</p>
    </div>
  );
}

function Sparkline({ data, up, label }: { data: number[]; up: boolean; label: string }) {
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${30 - ((v - min) / span) * 28 - 1}`).join(' ');
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={cn('h-12 w-full', up ? 'text-success' : 'text-destructive')} role="img" aria-label={label}>
      <polyline points={pts} fill="none" strokeWidth="1.5" vectorEffect="non-scaling-stroke" stroke="currentColor" />
    </svg>
  );
}

function AnalystBar({ analyst, currency }: { analyst: Record<string, number>; currency: string }) {
  const { t } = useT('bookclubs');
  const buy = Number(analyst.buy ?? 0), hold = Number(analyst.hold ?? 0), sell = Number(analyst.sell ?? 0);
  const total = buy + hold + sell;
  if (!total) return null;
  const seg = (n: number) => `${(n / total) * 100}%`;
  return (
    <div>
      <SectionHeading>{t('dailyCard.startup.consensus', { defaultValue: 'Analyst consensus' })}</SectionHeading>
      <div className="flex h-2.5 overflow-hidden rounded-full" role="img"
        aria-label={t('dailyCard.startup.consensusLabel', { buy, hold, sell, defaultValue: `${buy} buy, ${hold} hold, ${sell} sell` })}>
        <span className="bg-success" style={{ width: seg(buy) }} />
        <span style={{ width: seg(hold), background: TK.muted }} />
        <span className="bg-destructive" style={{ width: seg(sell) }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{t('dailyCard.startup.buy', { count: buy, defaultValue: `Buy ${buy}` })}</span>
        <span>{t('dailyCard.startup.hold', { count: hold, defaultValue: `Hold ${hold}` })}</span>
        <span>{t('dailyCard.startup.sell', { count: sell, defaultValue: `Sell ${sell}` })}</span>
        {typeof analyst.target === 'number' ? <span className="font-semibold text-foreground">{t('dailyCard.startup.target', { defaultValue: 'Target' })} {analyst.target.toLocaleString(undefined, { style: 'currency', currency })}</span> : null}
      </div>
    </div>
  );
}
