import { useState } from 'react';
import { useLoad, usd } from '../useLoad';
import { Pill, Problem, Table, copy } from './parts';

interface CallRow { call_id: number; run_id: string; stage: string; model: string; tokens_in: number; tokens_out: number; cached_in: number; cost_usd: number; ms: number; status: string; at: string }
interface Layer { kind: 'house' | 'stage' | 'voice' | 'learned' | 'data'; version: string; text: string }
interface Call extends CallRow { request: { layers?: Layer[]; system?: string; prompt?: string; truncated?: boolean } | null; reply: { text: string; truncated: boolean } | null; checks?: unknown; verdicts?: unknown; body_path?: string | null }

export const LAYER_LABEL: Record<Layer['kind'], string> = {
  house: 'House frame (locked)', stage: 'Stage task (house)', voice: "Club voice (your club's managers)", learned: 'Learned fixes (accepted member fixes)', data: "This edition's data",
};
const LAYER_EDGE: Record<Layer['kind'], string> = { house: 'border-s-muted-foreground', stage: 'border-s-muted-foreground', voice: 'border-s-primary', learned: 'border-s-foreground', data: 'border-s-accent' };

export function CallDetail({ clubId, callId }: { clubId: string; callId: number }) {
  const { data, error, loading } = useLoad<{ call: Call }>(`/clubs/${clubId}/gazette/ops/calls/${callId}`);
  const [copied, setCopied] = useState('');
  if (loading) return <p className="text-sm text-muted-foreground">Loading call...</p>;
  if (error || !data) return <Problem text={error} />;
  const c = data.call;
  const layers: Layer[] = c.request?.layers ?? (c.request ? [{ kind: 'house', version: '', text: c.request.system ?? '' }, { kind: 'data', version: '', text: c.request.prompt ?? '' }] : []);
  const promptText = layers.map((l) => l.text).join('\n\n');
  return (
    <section aria-label={`Call ${c.call_id}`} className="mt-4">
      <p className="mb-2 text-xs text-muted-foreground">
        {c.model} · {c.tokens_in.toLocaleString()} tokens in ({c.cached_in.toLocaleString()} cached) · {c.tokens_out.toLocaleString()} out · {usd(c.cost_usd)} · {(c.ms / 1000).toFixed(1)} s · <Pill tone={c.status}>{c.status}</Pill>
      </p>
      {!c.request && <p className="text-sm text-muted-foreground">This call's prompt and reply were moved to long-term storage; they open from there.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          {layers.map((l, i) => (
            <div key={i} className={`overflow-hidden rounded-lg border border-border border-s-4 ${LAYER_EDGE[l.kind]}`}>
              <header className="flex flex-wrap items-center gap-2 border-b border-border bg-muted px-3 py-1.5 text-xs"><b>{LAYER_LABEL[l.kind]}</b>{l.version && <span className="font-mono">{l.version}</span>}</header>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs">{l.text}</pre>
            </div>
          ))}
          {c.request?.truncated && <p className="text-xs text-muted-foreground">The prompt was cut at 64 KB.</p>}
        </div>
        <div className="grid content-start gap-2">
          <div className="overflow-hidden rounded-lg border border-border"><header className="border-b border-border bg-muted px-3 py-1.5 text-xs font-semibold">Reply</header><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs">{c.reply?.text ?? ''}</pre></div>
          {c.checks != null && <div className="overflow-hidden rounded-lg border border-border"><header className="border-b border-border bg-muted px-3 py-1.5 text-xs font-semibold">Checks</header><pre className="overflow-auto p-3 font-mono text-xs">{JSON.stringify(c.checks, null, 1)}</pre></div>}
          {c.verdicts != null && <div className="overflow-hidden rounded-lg border border-border"><header className="border-b border-border bg-muted px-3 py-1.5 text-xs font-semibold">Council</header><pre className="overflow-auto p-3 font-mono text-xs">{JSON.stringify(c.verdicts, null, 1)}</pre></div>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-md border border-border px-3 py-1.5 text-sm" onClick={async () => setCopied((await copy(promptText)) ? 'Prompt copied' : 'Copy is not allowed here')}>Copy prompt</button>
            <button type="button" className="rounded-md border border-border px-3 py-1.5 text-sm" onClick={async () => setCopied((await copy(c.reply?.text ?? '')) ? 'Reply copied' : 'Copy is not allowed here')}>Copy reply</button>
            <span role="status" className="self-center text-xs text-muted-foreground">{copied}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CallsTab({ clubId, runId }: { clubId: string; runId?: string }) {
  const [stage, setStage] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const q = new URLSearchParams();
  if (runId) q.set('run', runId);
  if (stage) q.set('stage', stage);
  const { data, error, loading } = useLoad<{ calls: CallRow[] }>(`/clubs/${clubId}/gazette/ops/calls${q.toString() ? `?${q}` : ''}`);
  return (
    <div>
      <label className="mb-3 inline-flex items-center gap-2 text-sm">Stage
        <select className="rounded-md border border-border bg-background px-2 py-1" value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="">All</option>{['scout', 'write', 'rewrite', 'skeptic', 'editor', 'arbiter', 'level', 'update'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
      <Problem text={error} />
      {data && <Table label="Calls" head={['Stage', 'Model', 'Tokens in', 'Out', 'Cost', 'Time', 'Status', '']} rows={data.calls.map((c) => [
        c.stage, c.model, c.tokens_in.toLocaleString(), c.tokens_out.toLocaleString(), usd(c.cost_usd), `${(c.ms / 1000).toFixed(1)} s`, <Pill key="s" tone={c.status}>{c.status}</Pill>,
        <button key="o" type="button" className="text-primary underline" onClick={() => setOpen(c.call_id)}>Open</button>,
      ])} />}
      {open !== null && <CallDetail clubId={clubId} callId={open} />}
    </div>
  );
}
