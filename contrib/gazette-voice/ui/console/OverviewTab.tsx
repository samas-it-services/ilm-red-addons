import { useLoad, usd } from '../useLoad';
import { Problem, Tile } from './parts';

interface Summary { edition_cost_usd: number; month_cost_usd: number; month_editions: number; cap_usd: number; calls: number; median_ms: number | null; stories_ready: number; stories_plain: number; open_fixes: number; auto_fixes_today: number }

export function OverviewTab({ clubId, week }: { clubId: string; week: string }) {
  const { data, error, loading } = useLoad<Summary>(`/clubs/${clubId}/gazette/ops/summary?week=${encodeURIComponent(week)}`);
  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (error || !data) return <Problem text={error ?? 'Nothing to show.'} />;
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
      <Tile k="This edition" v={usd(data.edition_cost_usd)} s={`of the ${usd(data.cap_usd)} cap`} meter={data.cap_usd ? data.edition_cost_usd / data.cap_usd : 0} />
      <Tile k="This month" v={usd(data.month_cost_usd)} s={`${data.month_editions} editions`} />
      <Tile k="Calls this edition" v={String(data.calls)} s={data.median_ms != null ? `median ${(data.median_ms / 1000).toFixed(1)} s` : undefined} />
      <Tile k="Stories" v={`${data.stories_ready} of ${data.stories_ready + data.stories_plain}`} s={`${data.stories_plain} shown as plain version`} />
      <Tile k="Open fixes" v={String(data.open_fixes)} s={`${data.auto_fixes_today} applied automatically today`} />
    </div>
  );
}
