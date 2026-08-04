/**
 * Club Quiz add-on — a per-level knowledge quiz rendered in a club's "Quiz" section.
 *
 * Reusable: questions come from the add-on's config (book_club_addons.config.levels) when present,
 * otherwise the built-in Cryptography set ships as the default so the add-on works the moment it is
 * enabled. Self-gates on useClubAddonEnabled so it renders nothing unless the club has it on.
 * Ten questions per level, an explanation on a wrong answer, and a total score at the end. On
 * completion a signed-in reader's attempt is saved via record_quiz_attempt and the club's global
 * stats for that level are shown; signed-out readers still see the aggregates via club_quiz_stats.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useClubAddonEnabled } from '@/hooks/useClubAddonEnabled';
import { useAuth } from '@/contexts/AuthContext';
import { rpcUntyped } from '@/lib/rpcUntyped';

interface QuizQ { q: string; options: string[]; answer: number; explain: string }
type Level = 'beginner' | 'intermediate' | 'expert';
type QuizData = Record<Level, QuizQ[]>;
interface QuizStats { attempts?: number; learners?: number; avg_pct?: number; top_pct?: number; your_best_pct?: number }

const LEVELS: Array<{ key: Level; label: string; blurb: string }> = [
  { key: 'beginner', label: 'Beginner', blurb: 'The story and the big ideas.' },
  { key: 'intermediate', label: 'Intermediate', blurb: 'How it actually works.' },
  { key: 'expert', label: 'Expert', blurb: 'The formal machinery.' },
];

// Built-in Cryptography quiz (companion to "Keeping a Secret on Someone Else's Machine").
const CRYPTO_QUIZ: QuizData = {
  beginner: [
    { q: 'A thief steals the whole storehouse of sealed books and stored keys. What do they get?', options: ['The library, ready to read', 'A pile of locked boxes and locked-up keys, and nothing they can open', 'Only the public books', 'The master key'], answer: 1, explain: 'Every book is sealed with its own key, and each key is stored only after being locked inside a master key kept elsewhere.' },
    { q: 'What is "envelope encryption" in plain words?', options: ['Encrypt everything with one shared key', 'Give each secret its own key, then lock that key inside one master key', 'Hide the key inside the file', 'Mail the key separately'], answer: 1, explain: 'Each book gets its own data key; that key is stored only after being sealed inside a master key.' },
    { q: 'Who is Hafiz Al-Kindi in the story?', options: ['The reader', 'A small clerk the browser runs that caches and seals pages', 'The author of the book', 'A server in the cloud'], answer: 1, explain: 'He is the service worker: he memorizes (caches) each page and guards (seals) it.' },
    { q: 'Why does the word "hafiz" fit that clerk?', options: ['It means fast', 'It means one who both memorizes and guards', 'It means a lock', 'It means a scholar only'], answer: 1, explain: 'A hafiz memorizes and guards, exactly the clerk’s double duty: cache the page and keep it sealed.' },
    { q: 'When is a cached page actually readable?', options: ['Always, once downloaded', 'Only for the instant it is shown on screen', 'Only when online', 'Never'], answer: 1, explain: 'At rest it is sealed; it is unsealed only at the moment of display.' },
    { q: 'How do you take a reader’s access away?', options: ['Delete their device', 'Stop issuing the key at the one checked door', 'Change the master key', 'Nothing can be done'], answer: 1, explain: 'The key is handed out only through one access-checked door; to revoke, make the check fail so it stops issuing.' },
    { q: 'The offline-versus-recall trade means...', options: ['Speed versus battery', 'A key on your device reads offline but is hard to recall instantly', 'Colour versus black and white', 'Nothing important'], answer: 1, explain: 'A permanent copy on the device reads offline but cannot be recalled at once. You choose where to stand.' },
    { q: 'Can encryption stop someone photographing the screen?', options: ['Yes, completely', 'No', 'Only in the dark', 'Only on phones'], answer: 1, explain: 'You cannot encrypt your way out of a camera.' },
    { q: 'So what does a watermark actually do about a screen photo?', options: ['Blocks the photo', 'Makes the leak traceable rather than impossible', 'Turns the screen black', 'Nothing'], answer: 1, explain: 'A faint per-reader mark rides along in a screenshot, so a leak points back to who leaked it.' },
    { q: 'Where is the one master key kept?', options: ['In the book file', 'In a vault the rest of the system cannot read into', 'On the reader’s device', 'In the page URL'], answer: 1, explain: 'The master key lives in a hardened vault; a database dump alone yields no usable key.' },
  ],
  intermediate: [
    { q: 'Where were the page images being cached that the first round of sealing missed?', options: ['The database', 'The service worker (the clerk’s drawer)', 'The CPU', 'The book file'], answer: 1, explain: 'A small clerk the browser runs beside every page had already cached the images in the clear.' },
    { q: 'Why seal inside the clerk instead of rerouting every page?', options: ['He is faster', 'The images already went to him, so sealing there covers them without touching every load', 'To give him work', 'It is cheaper to store'], answer: 1, explain: 'Rerouting every page is invasive; sealing in the clerk covers the very drawer where the images already live.' },
    { q: 'What sits on disk for a cached page?', options: ['The plain image', 'Ciphertext: a nonce, the sealed bytes, and a check', 'Nothing', 'A thumbnail'], answer: 1, explain: 'At rest the blob is nonsense: the nonce, the ciphertext, and a tag that is checked on opening.' },
    { q: 'What is a "non-extractable" key?', options: ['A key that expires', 'A key you may use but not read back out of its handle', 'A key with no password', 'A public key'], answer: 1, explain: 'The browser lets you lock and unlock with it, but refuses to hand the key bytes back out.' },
    { q: 'What is the honest caveat of a non-extractable key?', options: ['It is unbreakable', 'Raw key material still passes briefly through page memory', 'It cannot be used offline', 'It is slower'], answer: 1, explain: 'Non-extractability shrinks the exposure; it does not erase it.' },
    { q: 'The single engine combines two policy sources by taking...', options: ['The average', 'The stronger protection, never the weaker', 'The club’s choice only', 'The newest one'], answer: 1, explain: 'The union only ever adds protection; it cannot drop a book below its floor.' },
    { q: 'Which two sources feed that policy?', options: ['The device and the network', 'The book’s visibility default and the club’s own choices', 'The author and the reader', 'The time and the place'], answer: 1, explain: 'Who may see the book sets a default; a club’s settings layer on top.' },
    { q: 'What makes revocation "real" here?', options: ['Deleting the file', 'The key desk re-checks access before it issues a key', 'Changing the password', 'A timer'], answer: 1, explain: 'The only door that turns a sealed key usable first asks whether you may read, right now.' },
    { q: 'What is stored next to a book to hold its key?', options: ['The raw key', 'The wrapped (sealed) data key, useless without the master', 'Nothing', 'A hint'], answer: 1, explain: 'The data key is stored only after being locked inside the master key.' },
    { q: 'Why is a page said to be "readable only in memory"?', options: ['Because RAM is fast', 'It is unsealed only at the instant it is shown, then never rests unsealed', 'Because disks are slow', 'It is always readable'], answer: 1, explain: 'Plain text exists only at the moment of display; everywhere it rests, it is sealed.' },
  ],
  expert: [
    { q: 'In AES-256-GCM, what does the tag T do?', options: ['Speeds up decryption', 'Authenticates the data; it is verified before the plaintext is returned', 'Stores the key', 'Compresses the page'], answer: 1, explain: 'GCM is authenticated encryption: a flipped byte fails the tag check, so tampering is caught, not returned.' },
    { q: 'What is the at-rest blob layout?', options: ['ciphertext only', 'IV ‖ ciphertext ‖ tag', 'key ‖ ciphertext', 'tag ‖ IV'], answer: 1, explain: 'The stored blob is the nonce, then the ciphertext, then the 128-bit tag.' },
    { q: 'The one rule you must never break with GCM?', options: ['Never encrypt twice', 'Never reuse a nonce (IV) under the same key', 'Never use a 256-bit key', 'Never store the tag'], answer: 1, explain: 'Reusing an IV under one key collapses GCM’s confidentiality and unforgeability.' },
    { q: 'The envelope wrap is: wrapped = ?', options: ['DEK xor KEK', 'AEAD-Enc(KEK, iv, DEK)', 'hash(DEK)', 'DEK + KEK'], answer: 1, explain: 'The data key is sealed under the master key, so the stored wrapped key is useless without the KEK.' },
    { q: 'What is the DEK?', options: ['The master key', 'The per-book data key', 'A device key', 'A default key'], answer: 1, explain: 'DEK = data-encryption key, one per book; the KEK is the master that wraps it.' },
    { q: 'Revocation latency Δ for a memory-only key is about...', options: ['Infinite', '≈ 0 (re-checked on every resume)', 'One day', 'One hour'], answer: 1, explain: 'A memory-only key is fetched fresh on each resume, so access is re-checked every time.' },
    { q: 'Δ for a persisted (offline) key is about...', options: ['0', 'The time to the next online re-check', 'Infinite', 'One second'], answer: 1, explain: 'A key kept on the device reads offline but cannot be recalled until the next online check.' },
    { q: 'Which work underpins GCM?', options: ['Shannon (1949)', 'McGrew & Viega (2004)', 'Rivest et al. (1978)', 'Diffie & Hellman (1976)'], answer: 1, explain: 'McGrew & Viega formalized the Galois/Counter Mode used to seal each page.' },
    { q: 'Which idea formalizes the revocation / stateless-receiver trade?', options: ['Cox et al. (1997)', 'Naor, Naor & Lotspiech (2001)', 'RFC 3394', 'Kahn (1967)'], answer: 1, explain: 'Their revocation-and-tracing schemes give the formal shape of offline versus recall.' },
    { q: 'The cross-realm bug was fixed by...', options: ['Adding a try/catch', 'Checking what a value IS (a byte view) rather than where it was born', 'Restarting the worker', 'Disabling tests'], answer: 1, explain: 'Identity by birthplace breaks across realms; asking what a value is holds in every realm.' },
  ],
};

export const ClubQuiz: React.FC<{ clubId: string }> = ({ clubId }) => {
  const enabled = useClubAddonEnabled(clubId, 'club-quiz');

  // Config override: book_club_addons.config.levels, if a curator has set custom questions.
  const cfg = useQuery({
    queryKey: ['clubQuizConfig', clubId],
    enabled: !!clubId && enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<{ levels: QuizData; sourceSlug: string | null } | null> => {
      const { data } = await supabase
        .from('book_club_addons')
        .select('config, addon:addon_registry!inner(slug)')
        .eq('book_club_id', clubId)
        .eq('addon.slug', 'club-quiz')
        .maybeSingle();
      const cfgRow = (data as { config?: { levels?: QuizData; source_post?: string } } | null)?.config;
      const levels = cfgRow?.levels;
      const ok = levels && LEVELS.every((l) => Array.isArray(levels[l.key]) && levels[l.key].length > 0);
      if (!ok) return null;

      // config.source_post is a blog_posts.id, but /blog/:slug resolves by SLUG only — linking the
      // raw id would 404. Resolve it here; a missing/unpublished post just yields no link.
      let sourceSlug: string | null = null;
      if (cfgRow?.source_post) {
        const { data: post } = await supabase
          .from('blog_posts')
          .select('slug')
          .eq('id', cfgRow.source_post)
          .maybeSingle();
        sourceSlug = (post as { slug?: string } | null)?.slug ?? null;
      }
      return { levels: levels as QuizData, sourceSlug };
    },
  });

  const quiz = cfg.data?.levels ?? CRYPTO_QUIZ;
  const sourceSlug = cfg.data?.sourceSlug ?? null;

  // Both are read off whatever quiz actually loaded, so the copy can never drift from the data.
  // LEVELS[0] is the shortest level; every level is generated with the same count, and a mismatch
  // would be a generator bug worth seeing rather than papering over.
  const questionCount = quiz[LEVELS[0].key]?.length ?? 0;
  const companionHref = sourceSlug ? `/blog/${sourceSlug}` : null;

  const { user } = useAuth();
  const [level, setLevel] = useState<Level | null>(null);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState<QuizStats | null>(null);
  const [saved, setSaved] = useState(false);

  const questions = useMemo(() => (level ? quiz[level] : []), [level, quiz]);

  // On completion: a signed-in reader's attempt is recorded and we get the level's global stats back;
  // a signed-out reader still gets the read-only aggregates. Best-effort — the score screen shows
  // regardless. Guarded by `saved` so a re-render can't double-insert.
  useEffect(() => {
    if (!done || !level || saved) return;
    setSaved(true);
    const total = quiz[level].length;
    (async () => {
      try {
        if (user) {
          const { data } = await rpcUntyped<QuizStats>('record_quiz_attempt',
            { p_club_id: clubId, p_level: level, p_score: score, p_total: total });
          if (data && (data as { ok?: boolean }).ok !== false) setStats(data);
        } else {
          const { data } = await rpcUntyped<Partial<Record<Level, QuizStats>>>('club_quiz_stats', { p_club_id: clubId });
          if (data) setStats(data[level] ?? null);
        }
      } catch { /* stats are best-effort */ }
    })();
  }, [done, level, saved, user, clubId, score, quiz]);

  if (!enabled) return null;

  const reset = () => { setLevel(null); setIdx(0); setPicked(null); setScore(0); setDone(false); setStats(null); setSaved(false); };
  const start = (lv: Level) => { setLevel(lv); setIdx(0); setPicked(null); setScore(0); setDone(false); setStats(null); setSaved(false); };

  // ── Level chooser ──
  if (!level) {
    return (
      <div className="max-w-2xl">
        <h2 className="text-2xl font-bold text-foreground mb-1">Test your understanding</h2>
        {/*
          The intro is DERIVED, never hardcoded. It used to read "Ten questions per level,
          companion to the Keeping a Secret essay" on every club — wrong on both counts as soon
          as blog-quiz generated a quiz for a different post with a different question count.
          Count comes from the quiz actually loaded; the companion line only appears when the
          add-on config records which post it was generated from.
        */}
        <p className="text-muted-foreground mb-5">
          {questionCount > 0
            ? `${questionCount} question${questionCount === 1 ? '' : 's'} per level. `
            : ''}
          You will see an explanation whenever you miss one, and a total score at the end.
          {companionHref ? (
            <>
              {' '}This one is a companion to{' '}
              <a href={companionHref} className="font-bold text-primary underline underline-offset-2">
                the essay it was generated from
              </a>.
            </>
          ) : null}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {LEVELS.map((l) => (
            <button key={l.key} type="button" onClick={() => start(l.key)}
              className="rounded-2xl border border-border bg-card p-4 text-left hover:border-primary transition-colors">
              <div className="font-bold text-foreground">{l.label}</div>
              <div className="text-sm text-muted-foreground mt-1">{l.blurb}</div>
              <div className="text-xs text-muted-foreground mt-3">{quiz[l.key].length} questions</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Score screen ──
  if (done) {
    const total = questions.length;
    const pct = Math.round((score / total) * 100);
    const msg = pct === 100 ? 'Flawless. You could give the talk.'
      : pct >= 70 ? 'Strong. The ideas landed.'
      : pct >= 40 ? 'A good start. Worth another pass.'
      : 'Early days. Re-read and try again.';
    return (
      <div className="max-w-2xl">
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <div className="text-sm uppercase tracking-wide text-muted-foreground">{LEVELS.find((l) => l.key === level)?.label} · result</div>
          <div className="text-5xl font-extrabold text-foreground mt-2">{score} / {total}</div>
          <div className="text-primary font-semibold mt-1">{pct}%</div>
          <p className="text-muted-foreground mt-3">{msg}</p>
          {stats && (stats.attempts ?? 0) > 0 && (
            <div className="mt-4 rounded-xl border border-border bg-background/60 px-4 py-3 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{stats.learners ?? stats.attempts}</span>{' '}
              {(stats.learners ?? stats.attempts) === 1 ? 'reader has' : 'readers have'} taken this level ·
              class average <span className="font-semibold text-foreground">{stats.avg_pct}%</span>
              {typeof stats.your_best_pct === 'number' && (
                <> · your best <span className="font-semibold text-foreground">{stats.your_best_pct}%</span></>
              )}
            </div>
          )}
          {!user && (
            <p className="mt-3 text-xs text-muted-foreground">Sign in to save your score and see how you compare.</p>
          )}
          <div className="flex flex-wrap justify-center gap-2 mt-5">
            <button type="button" onClick={() => start(level)} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Retake this level</button>
            <button type="button" onClick={reset} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground">Choose another level</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Question screen ──
  const q = questions[idx];
  const answered = picked !== null;
  const correct = answered && picked === q.answer;
  const choose = (i: number) => {
    if (answered) return;
    setPicked(i);
    if (i === q.answer) setScore((s) => s + 1);
  };
  const next = () => {
    if (idx + 1 >= questions.length) { setDone(true); return; }
    setIdx(idx + 1); setPicked(null);
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-muted-foreground">{LEVELS.find((l) => l.key === level)?.label} · Question {idx + 1} of {questions.length}</div>
        <div className="text-sm text-muted-foreground">Score {score}</div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted mb-5 overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${((idx + (answered ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-lg font-semibold text-foreground mb-4">{q.q}</p>
        <div className="space-y-2">
          {q.options.map((opt, i) => {
            const isAnswer = i === q.answer;
            const isPicked = i === picked;
            const cls = !answered
              ? 'border-border bg-background hover:border-primary'
              : isAnswer
                ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200'
                : isPicked
                  ? 'border-destructive bg-destructive/10 text-destructive'
                  : 'border-border bg-background opacity-70';
            return (
              <button key={i} type="button" onClick={() => choose(i)} disabled={answered}
                className={`block w-full rounded-xl border px-4 py-3 text-left transition-colors ${cls}`}>
                {opt}
              </button>
            );
          })}
        </div>

        {answered && (
          <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${correct ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200' : 'bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-100'}`}>
            <span className="font-bold">{correct ? 'Correct. ' : 'Not quite. '}</span>{q.explain}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button type="button" onClick={next} disabled={!answered}
            className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
            {idx + 1 >= questions.length ? 'See my score' : 'Next question'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClubQuiz;
