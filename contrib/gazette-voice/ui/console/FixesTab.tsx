import { useState } from 'react';
import { useSdk } from '../../../_sdk/react';
import { useLoad, newIdempotencyKey, usd } from '../useLoad';
import { Pill, Problem } from './parts';

interface FixRow { fix_id: string; story_id: string; headline: string; kind: string; quote: string | null; replacement: string; reason: string | null; member: string | null; check: { flagged?: boolean; problems?: string[]; supported?: boolean } | null; state: string; auto: boolean; at: string }

const KIND: Record<string, string> = { fact: 'Wrong fact', link: 'Wrong or broken link', tone: 'Tone or hurtful', wording: 'Wording or typo', term_level: 'Wrong term level', wrong_term: 'Not the right term', other: 'Other' };

function FixCard({ f, onDone }: { f: FixRow; onDone: () => void }) {
  const { api } = useSdk();
  const [rule, setRule] = useState('');
  const [reply, setReply] = useState('');
  const [mode, setMode] = useState<'learn' | 'reject' | null>(null);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const post = async (body: object, opts?: { idempotencyKey?: string }, path = `/gazette/fixes/${f.fix_id}/action`) => {
    setProblem(null);
    try { const r = await api.post<{ estimate_usd?: number }>(path, body, opts); onDone(); return r; } catch (e) { setProblem(e instanceof Error ? e.message : String(e)); return null; }
  };
  const flagged = !!f.check?.flagged;
  return (
    <article className="grid gap-2 rounded-lg border border-border p-3 text-sm" aria-label={`Fix on ${f.headline}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={flagged ? 'flagged' : f.auto ? 'applied' : f.state}>{flagged ? 'Flagged' : f.auto ? 'Applied automatically' : KIND[f.kind] ?? f.kind}</Pill>
        <b>{f.headline}</b><span className="ms-auto text-xs text-muted-foreground">{f.member ?? 'A former member'}</span>
      </div>
      {f.quote && <p>&ldquo;{f.quote}&rdquo; to &ldquo;{f.replacement}&rdquo;</p>}
      {!f.quote && <p>{f.replacement}</p>}
      {f.reason && <p className="text-muted-foreground">Why: {f.reason}</p>}
      {flagged && <p className="text-xs text-destructive">This reads like an instruction to the AI, so it will never reach a prompt.</p>}
      {f.check?.supported === false && <p className="text-xs text-muted-foreground">Check: the paper and its sources do not support this; a rewrite would not use it.</p>}
      <Problem text={problem} />
      <div className="flex flex-wrap gap-2">
        {f.auto && f.state === 'applied' && <><button type="button" className="rounded-md border border-border px-3 py-1" onClick={() => post({ action: 'undo' })}>Undo</button></>}
        {f.state === 'waiting' && !flagged && <>
          <button type="button" className="rounded-md border border-border px-3 py-1" onClick={() => post({ action: 'apply' })}>Apply as written</button>
          {estimate === null
            ? <button type="button" className="rounded-md border border-border px-3 py-1" onClick={async () => { try { const r = await api.post<{ estimate_usd: number }>(`/gazette/fixes/${f.fix_id}/action?estimate=true`, { action: 'regenerate' }); setEstimate(r.estimate_usd); } catch (e) { setProblem(e instanceof Error ? e.message : String(e)); } }}>Regenerate with it</button>
            : <button type="button" className="rounded-md bg-primary px-3 py-1 text-primary-foreground" onClick={() => post({ action: 'regenerate', budget_usd: Math.ceil(estimate * 120) / 100 }, { idempotencyKey: newIdempotencyKey() })}>Regenerate for {usd(estimate)}</button>}
          <button type="button" className="rounded-md border border-border px-3 py-1" onClick={() => setMode('learn')}>Also learn it</button>
        </>}
        {f.state === 'waiting' && <button type="button" className="rounded-md border border-border px-3 py-1" onClick={() => setMode('reject')}>Reject</button>}
      </div>
      {mode === 'learn' && (
        <div className="grid gap-1">
          <label htmlFor={`rule-${f.fix_id}`}>Write it as one rule for future stories</label>
          <input id={`rule-${f.fix_id}`} className="rounded-md border border-border bg-background p-2" value={rule} onChange={(e) => setRule(e.target.value)} />
          <div><button type="button" className="rounded-md bg-primary px-3 py-1 text-primary-foreground" onClick={() => post({ action: 'learn', rule })}>Save rule</button></div>
        </div>
      )}
      {mode === 'reject' && (
        <div className="grid gap-1">
          <label htmlFor={`reply-${f.fix_id}`}>Reply to the member (optional)</label>
          <input id={`reply-${f.fix_id}`} className="rounded-md border border-border bg-background p-2" value={reply} onChange={(e) => setReply(e.target.value)} />
          <div><button type="button" className="rounded-md border border-border px-3 py-1" onClick={() => post({ action: 'reject', reply })}>Reject fix</button></div>
        </div>
      )}
    </article>
  );
}

export function FixesTab({ clubId }: { clubId: string }) {
  const { data, error, loading, reload } = useLoad<{ fixes: FixRow[] }>(`/clubs/${clubId}/gazette/fixes?state=open`);
  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (error || !data) return <Problem text={error} />;
  if (!data.fixes.length) return <p className="text-sm text-muted-foreground">No fixes waiting.</p>;
  return <div className="grid gap-3">{data.fixes.map((f) => <FixCard key={f.fix_id} f={f} onDone={() => void reload()} />)}</div>;
}
