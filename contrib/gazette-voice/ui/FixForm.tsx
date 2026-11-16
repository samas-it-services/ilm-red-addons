import { useState } from 'react';
import { useSdk } from '../../_sdk/react';
import type { NewsroomStoryData } from './types';

const KINDS = [['wording', 'Wording or typo'], ['fact', 'Wrong fact'], ['link', 'Wrong or broken link'], ['tone', 'Tone or hurtful'], ['term_level', 'Wrong term level'], ['wrong_term', 'Not the right term'], ['other', 'Other']] as const;
const EM = String.fromCharCode(0x2014);
const REASONS: Record<string, string> = {
  one_open_fix_per_story: 'You already have a fix waiting on this story.',
  daily_limit: 'You have sent 10 fixes today. Try again tomorrow.',
  not_club_member: 'Join the club to suggest fixes.',
  not_signed_in: 'Sign in to suggest a fix.',
};

/** "Suggest a fix" for any signed-in member. The quote is the words the member selected in the story. */
export function FixForm({ story, quote = '', onClose, onSent }: { story: NewsroomStoryData; quote?: string; onClose: () => void; onSent?: (state: 'applied' | 'waiting') => void }) {
  const { api } = useSdk();
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>('wording');
  const [replacement, setReplacement] = useState('');
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!replacement.trim()) return setResult({ ok: false, text: 'Write the fix first.' });
    if (replacement.length > 500 || reason.length > 500) return setResult({ ok: false, text: 'Keep each box under 500 characters.' });
    if ((replacement + reason).includes(EM)) return setResult({ ok: false, text: 'Use a comma, colon or full stop instead of a long dash.' });
    setBusy(true);
    try {
      const r = await api.post<{ state: 'applied' | 'waiting' }>(`/gazette/stories/${story.story_id}/fixes`, { kind, quote: quote || undefined, replacement, reason: reason || undefined });
      setResult({ ok: true, text: r.state === 'applied' ? 'Thanks. Your fix is live now, and the club can see it in History.' : "Thanks. The club's managers will look at it; you will get their reply." });
      onSent?.(r.state);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setResult({ ok: false, text: REASONS[Object.keys(REASONS).find((k) => m.includes(k)) ?? ''] ?? 'That did not send. Please try again.' });
    } finally { setBusy(false); }
  };
  return (
    <form className="grid max-w-lg gap-3 rounded-lg border border-border bg-background p-4 text-sm shadow-md" aria-label="Suggest a fix" onSubmit={(e) => { e.preventDefault(); void send(); }}>
      <h4 className="text-base font-semibold">Suggest a fix</h4>
      <p className="text-xs text-muted-foreground">{story.headline}</p>
      <fieldset className="grid gap-1"><legend className="mb-1 font-semibold">What kind of fix?</legend>
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map(([k, l]) => <label key={k} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1"><input type="radio" name="gv-kind" checked={kind === k} onChange={() => setKind(k)} />{l}</label>)}
        </div>
      </fieldset>
      {quote && <div><span className="font-semibold">The words you picked</span><p className="mt-1 rounded-md bg-muted p-2">{quote}</p></div>}
      <label className="grid gap-1" htmlFor="gv-fix-text"><span className="font-semibold">{quote ? 'Change it to' : 'Your fix'}</span>
        <textarea id="gv-fix-text" className="min-h-16 rounded-md border border-border bg-background p-2" dir={story.lang === 'ur' ? 'rtl' : 'ltr'} value={replacement} onChange={(e) => setReplacement(e.target.value)} /></label>
      <label className="grid gap-1" htmlFor="gv-fix-why"><span className="font-semibold">Why (optional)</span>
        <textarea id="gv-fix-why" className="min-h-12 rounded-md border border-border bg-background p-2" dir={story.lang === 'ur' ? 'rtl' : 'ltr'} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      {kind === 'wording' && <p className="text-xs text-muted-foreground">A small wording fix that changes no number, name, link or quote goes live straight away. The club's managers can see and undo it.</p>}
      {result && <p role={result.ok ? 'status' : 'alert'} className={result.ok ? 'text-primary' : 'text-destructive'}>{result.text}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="rounded-md border border-border px-3 py-1.5" onClick={onClose}>{result?.ok ? 'Close' : 'Cancel'}</button>
        {!result?.ok && <button type="submit" disabled={busy} className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground">Send fix</button>}
      </div>
    </form>
  );
}
