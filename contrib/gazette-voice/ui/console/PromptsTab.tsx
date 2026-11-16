import { useState } from 'react';
import { useSdk } from '../../../_sdk/react';
import { useLoad, newIdempotencyKey, usd } from '../useLoad';
import { Problem } from './parts';

interface PromptDetail { house: { text: string; version: string }; default_version: number | null; versions: Array<{ version: number; voice: string; note: string | null; at: string }>; learned: Array<{ rule_id: string; text: string; pinned: boolean; from_fix: string | null }> }
export interface PaperChoice { id: string; title: string }

const STAGES = [['write', 'Writer'], ['update', 'Update line'], ['editor', 'Editor seat']] as const;
const EM = String.fromCharCode(0x2014);

/** The club's voice for one stage and language: house frame (read only), versions, Try, default, learned rules. */
export function PromptsTab({ clubId, papers }: { clubId: string; papers: PaperChoice[] }) {
  const { api } = useSdk();
  const [stage, setStage] = useState<(typeof STAGES)[number][0]>('write');
  const [lang, setLang] = useState<'en' | 'ur'>('en');
  const base = `/clubs/${clubId}/gazette/prompts/${stage}/${lang}`;
  const { data, error, reload } = useLoad<PromptDetail>(base);
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [tryPapers, setTryPapers] = useState<string[]>([]);
  const [estimate, setEstimate] = useState<{ version: number; usd: number } | null>(null);

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setProblem(null); setMsg(null);
    try { await fn(); setMsg(done); await reload(); } catch (e) { setProblem(e instanceof Error ? e.message : String(e)); }
  };
  const save = () => {
    if (draft.trim().length < 20) return setProblem('A voice needs at least 20 characters.');
    if (draft.includes(EM)) return setProblem('Use a comma, colon or full stop instead of a long dash.');
    return act(() => api.post(`${base}/versions`, { voice: draft, note }), 'Saved as a new version. It is not the default until you make it so.');
  };
  const price = async (version: number) => {
    setProblem(null);
    try { const r = await api.post<{ estimate_usd: number }>(`${base}/try?estimate=true`, { version, paper_ids: tryPapers, budget_usd: 0 }); setEstimate({ version, usd: r.estimate_usd }); }
    catch (e) { setProblem(e instanceof Error ? e.message : String(e)); }
  };
  const runTry = (v: { version: number; usd: number }) => act(() => api.post(`${base}/try`, { version: v.version, paper_ids: tryPapers, budget_usd: Math.ceil(v.usd * 120) / 100 }, { idempotencyKey: newIdempotencyKey() }), 'Trial started. Its stories appear in Runs next to the live ones and are never published.');

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-3 text-sm">
        <label className="inline-flex items-center gap-2">Stage<select className="rounded-md border border-border bg-background px-2 py-1" value={stage} onChange={(e) => { setStage(e.target.value as typeof stage); setEstimate(null); }}>{STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="inline-flex items-center gap-2">Language<select className="rounded-md border border-border bg-background px-2 py-1" value={lang} onChange={(e) => { setLang(e.target.value as 'en' | 'ur'); setEstimate(null); }}><option value="en">English</option><option value="ur">Urdu</option></select></label>
      </div>
      <Problem text={error ?? problem} />
      {msg && <p role="status" className="text-sm text-primary">{msg}</p>}
      {data && (
        <>
          <details className="rounded-lg border border-border">
            <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">House frame <span className="font-mono text-xs">{data.house.version}</span> <span className="font-normal text-muted-foreground">(set by ilm.red; read only)</span></summary>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t border-border p-3 font-mono text-xs">{data.house.text}</pre>
          </details>
          <section aria-label="Voice versions" className="grid gap-2">
            <h4 className="font-semibold">Club voice versions</h4>
            {data.versions.length === 0 && <p className="text-sm text-muted-foreground">No club voice yet; the default voice is used.</p>}
            {data.versions.map((v) => (
              <div key={v.version} className="rounded-lg border border-border p-3 text-sm">
                <div className="mb-1 flex flex-wrap items-center gap-2"><b>v{v.version}</b>{v.version === data.default_version && <span className="rounded bg-muted px-1.5 font-mono text-xs">default</span>}<span className="text-xs text-muted-foreground">{v.note}</span></div>
                <p className="whitespace-pre-wrap">{v.voice}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {v.version !== data.default_version && <button type="button" className="rounded-md border border-border px-3 py-1 text-sm" onClick={() => act(() => api.post(`${base}/default`, { version: v.version }), `v${v.version} is now the default from the next edition.`)}>Make default</button>}
                  <button type="button" className="rounded-md border border-border px-3 py-1 text-sm" disabled={tryPapers.length === 0} onClick={() => price(v.version)}>Price a trial</button>
                </div>
              </div>
            ))}
          </section>
          <fieldset className="rounded-lg border border-border p-3 text-sm">
            <legend className="px-1 font-semibold">Papers to try on (up to 3)</legend>
            {papers.map((p) => (
              <label key={p.id} className="flex items-center gap-2"><input type="checkbox" checked={tryPapers.includes(p.id)} disabled={!tryPapers.includes(p.id) && tryPapers.length >= 3} onChange={(e) => setTryPapers(e.target.checked ? [...tryPapers, p.id] : tryPapers.filter((x) => x !== p.id))} />{p.title}</label>
            ))}
            {estimate && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span>Trying v{estimate.version} on {tryPapers.length} paper{tryPapers.length === 1 ? '' : 's'} costs about <b>{usd(estimate.usd)}</b> from your club's AI budget.</span>
                <button type="button" className="rounded-md bg-primary px-3 py-1 text-primary-foreground" onClick={() => runTry(estimate)}>Try it for {usd(estimate.usd)}</button>
              </div>
            )}
          </fieldset>
          <section aria-label="New version" className="grid gap-2">
            <label htmlFor="gv-voice" className="font-semibold">New voice version</label>
            <textarea id="gv-voice" className="min-h-24 rounded-md border border-border bg-background p-2 text-sm" dir={lang === 'ur' ? 'rtl' : 'ltr'} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Tone, humour, words to prefer or avoid, a short example story." />
            <label htmlFor="gv-note" className="text-sm">What changed (optional)</label>
            <input id="gv-note" className="rounded-md border border-border bg-background p-2 text-sm" value={note} onChange={(e) => setNote(e.target.value)} />
            <div><button type="button" className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground" onClick={save}>Save as new version</button></div>
          </section>
          <section aria-label="Learned fixes" className="grid gap-2">
            <h4 className="font-semibold">Learned fixes ({data.learned.length} of 10)</h4>
            {data.learned.map((l) => (
              <div key={l.rule_id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2 text-sm">
                <span className="flex-1">{l.text}</span>
                <button type="button" className="rounded-md border border-border px-2 py-0.5" onClick={() => act(() => api.patch(`/clubs/${clubId}/gazette/learned/${l.rule_id}`, { pinned: !l.pinned }), l.pinned ? 'Unpinned.' : 'Pinned.')}>{l.pinned ? 'Unpin' : 'Pin'}</button>
                <button type="button" className="rounded-md border border-border px-2 py-0.5" onClick={() => act(() => api.patch(`/clubs/${clubId}/gazette/learned/${l.rule_id}`, { removed: true }), 'Removed.')}>Remove</button>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
