import { useState } from 'react';
import { useSdk } from '../../../_sdk/react';
import { useLoad } from '../useLoad';
import { Problem } from './parts';

interface Addon { slug: string; enabled: boolean; config: Record<string, unknown> }
const SOURCES = [['hn', 'Hacker News'], ['hf', 'Hugging Face'], ['s2', 'Semantic Scholar'], ['news', 'News'], ['github', 'GitHub'], ['youtube', 'YouTube']] as const;

/** Uses the app's existing add-on settings operation (PATCH /clubs/{club}/addons), which only the club owner and admins may call. */
export function SettingsTab({ clubId }: { clubId: string }) {
  const { api } = useSdk();
  const { data, error, reload } = useLoad<{ addons: Addon[] }>(`/clubs/${clubId}/addons`);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const cfg = data?.addons.find((a) => a.slug === 'gazette-voice')?.config ?? {};
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const c = { voice: 'newsroom', sources: SOURCES.map(([k]) => k), edition_budget_usd: 0.5, updates: true, length: 'standard', daily_regenerations: 20, ...cfg, ...draft };
  const set = (k: string, v: unknown) => { setSaved(false); setDraft({ ...(draft ?? {}), [k]: v }); };
  const save = async () => {
    setProblem(null);
    try { await api.patch(`/clubs/${clubId}/addons`, { slug: 'gazette-voice', config: draft ?? {} }); setSaved(true); setDraft(null); await reload(); }
    catch (e) { const m = e instanceof Error ? e.message : String(e); setProblem(/not_club_admin/.test(m) ? 'Only the club owner and admins can change these settings.' : m); }
  };
  return (
    <form className="grid max-w-xl gap-3 text-sm" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <Problem text={error ?? problem} />
      <label className="grid gap-1"><span className="font-semibold">Voice</span>
        <select id="gv-voice-mode" className="rounded-md border border-border bg-background p-2" value={String(c.voice)} onChange={(e) => set('voice', e.target.value)}><option value="newsroom">Newsroom (lively, links coverage)</option><option value="plain">Plain</option></select></label>
      <fieldset className="grid gap-1"><legend className="font-semibold">Sources</legend>
        {SOURCES.map(([k, l]) => <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={(c.sources as string[]).includes(k)} onChange={(e) => set('sources', e.target.checked ? [...(c.sources as string[]), k] : (c.sources as string[]).filter((x) => x !== k))} />{l}</label>)}
      </fieldset>
      <label className="grid gap-1"><span className="font-semibold">Cap per edition (US dollars)</span>
        <input id="gv-cap" type="number" min={0.05} max={1} step={0.05} className="rounded-md border border-border bg-background p-2" value={Number(c.edition_budget_usd)} onChange={(e) => set('edition_budget_usd', Number(e.target.value))} /></label>
      <label className="flex items-center gap-2"><input id="gv-updates" type="checkbox" checked={!!c.updates} onChange={(e) => set('updates', e.target.checked)} />Check for new coverage on day 3 and day 10</label>
      <label className="grid gap-1"><span className="font-semibold">Story length</span>
        <select id="gv-length" className="rounded-md border border-border bg-background p-2" value={String(c.length)} onChange={(e) => set('length', e.target.value)}><option value="standard">Standard (90 to 160 words)</option><option value="short">Short (about 60 to 110 words)</option></select></label>
      <label className="grid gap-1"><span className="font-semibold">Regenerations a day</span>
        <input id="gv-regen" type="number" min={0} max={100} className="rounded-md border border-border bg-background p-2" value={Number(c.daily_regenerations)} onChange={(e) => set('daily_regenerations', Number(e.target.value))} /></label>
      <div className="flex items-center gap-3"><button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground" disabled={!draft}>Save settings</button>{saved && <span role="status" className="text-primary">Saved.</span>}</div>
    </form>
  );
}
