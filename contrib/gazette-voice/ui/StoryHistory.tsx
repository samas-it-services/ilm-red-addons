import { useState } from 'react';
import { useSdk } from '../../_sdk/react';
import { useLoad } from './useLoad';

interface Rev { revision: number; at: string; kind: string; summary: string; who: 'desk' | 'member' | 'manager' | 'automatic'; undoable: boolean }
const WHO: Record<Rev['who'], string> = { desk: 'The desk', member: 'A member', manager: 'A manager', automatic: 'Automatic' };

/** Every version of a story: what changed, who and why. Managers can go back to any earlier one. */
export function StoryHistory({ storyId, onChanged }: { storyId: string; onChanged?: () => void }) {
  const { api } = useSdk();
  const { data, error, reload } = useLoad<{ revisions: Rev[] }>(`/gazette/stories/${storyId}/history`);
  const [problem, setProblem] = useState<string | null>(null);
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading history...</p>;
  return (
    <section aria-label="Story history" className="rounded-lg border border-border bg-background p-4">
      <h4 className="mb-2 font-semibold">History</h4>
      {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
      <ol className="divide-y divide-border">
        {data.revisions.map((r) => (
          <li key={r.revision} className="grid grid-cols-1 gap-2 py-2 text-sm sm:grid-cols-[9rem_1fr_auto]">
            <time className="font-mono text-xs text-muted-foreground" dateTime={r.at}>{new Date(r.at).toISOString().slice(0, 16).replace('T', ' ')}</time>
            <div>{r.summary}<div className="text-xs text-muted-foreground">{WHO[r.who]} · version {r.revision}</div></div>
            {r.undoable && <button type="button" className="h-fit rounded-md border border-border px-3 py-1" onClick={async () => {
              try { await api.post(`/gazette/stories/${storyId}/undo`, { revision: r.revision }); await reload(); onChanged?.(); } catch (e) { setProblem(e instanceof Error ? e.message : String(e)); }
            }}>Go back to this</button>}
          </li>
        ))}
      </ol>
    </section>
  );
}
