import { useLoad, usd } from '../useLoad';
import { Pill, Problem, Table } from './parts';

interface Run { run_id: string; kind: string; week: string; lang: string; stages: string[]; stories: number; calls: number; cost_usd: number; estimate_usd: number | null; status: string }

const KIND: Record<string, string> = { edition: 'Edition', trial: 'Trial', regenerate: 'Regenerate', update: 'Update check' };

export function RunsTab({ clubId, onOpenRun }: { clubId: string; onOpenRun: (runId: string) => void }) {
  const { data, error, loading } = useLoad<{ runs: Run[] }>(`/clubs/${clubId}/gazette/ops/runs`);
  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (error || !data) return <Problem text={error} />;
  if (!data.runs.length) return <p className="text-sm text-muted-foreground">No runs yet.</p>;
  return (
    <Table label="Runs" head={['Run', 'Kind', 'Stages', 'Stories', 'Calls', 'Cost', 'Status']} rows={data.runs.map((r) => [
      <button key="w" type="button" className="text-primary underline" onClick={() => onOpenRun(r.run_id)}>{`${r.week} · ${r.lang === 'ur' ? 'Urdu' : 'English'}`}</button>,
      KIND[r.kind] ?? r.kind, r.stages.join(' · '), r.stories, r.calls,
      r.status === 'priced' ? `${usd(r.estimate_usd)} (estimate)` : usd(r.cost_usd),
      <Pill key="s" tone={r.status}>{r.status === 'priced' ? 'Priced, waiting' : r.status}</Pill>,
    ])} />
  );
}
