// @ts-check
/**
 * The reference SQL in real Postgres (PGlite), against a small stand-in of the ilm.red tables it relies on.
 * Each test gets a fresh database.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const SQL_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'sql');
const STUBS = fs.readFileSync(path.join(SQL_DIR, 'stubs.test.sql'), 'utf8');
const ADDON = fs.readFileSync(path.join(SQL_DIR, 'gazette-voice.sql'), 'utf8');

const U = {
  owner: '00000000-0000-0000-0000-0000000000a1', admin: '00000000-0000-0000-0000-0000000000a2', mod: '00000000-0000-0000-0000-0000000000a3',
  m1: '00000000-0000-0000-0000-0000000000b1', m2: '00000000-0000-0000-0000-0000000000b2', m3: '00000000-0000-0000-0000-0000000000b3',
  fresh: '00000000-0000-0000-0000-0000000000b9', outsider: '00000000-0000-0000-0000-0000000000c1', superAdmin: '00000000-0000-0000-0000-0000000000d1',
  otherOwner: '00000000-0000-0000-0000-0000000000e1',
};
const CLUB = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';
const PAPER = '33333333-3333-3333-3333-333333333333';
const BODY = 'Remember the Platonic Representation Hypothesis? Models yet still trail far behind two models of the same kind.';

/** @type {PGlite} */
let db;
/** @type {string} */
let story;
/** @type {string} */
let run;

/** @param {string} sql @param {any[]} [params] */
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
/** @param {string} fn @param {any[]} args */
const api = async (fn, args) => {
  const ph = args.map((_, i) => `$${i + 1}`).join(', ');
  return /** @type {any} */ (await one(`SELECT ${fn}(${ph}) AS r`, args)).r;
};
const apply = (body = BODY.replace('trail far behind', 'lag well behind')) => JSON.stringify({ body, terms: [] });

beforeEach(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  await db.exec(`
    INSERT INTO book_clubs VALUES ('${CLUB}', '${U.owner}', 'ai', 'AI'), ('${OTHER}', '${U.otherOwner}', 'other', 'Other');
    INSERT INTO book_club_members (book_club_id, user_id, role, joined_at) VALUES
      ('${CLUB}', '${U.admin}', 'admin', now() - interval '60 days'), ('${CLUB}', '${U.mod}', 'moderator', now() - interval '60 days'),
      ('${CLUB}', '${U.m1}', 'member', now() - interval '30 days'), ('${CLUB}', '${U.m2}', 'member', now() - interval '30 days'),
      ('${CLUB}', '${U.m3}', 'member', now() - interval '30 days'), ('${CLUB}', '${U.fresh}', 'member', now() - interval '1 day');
    INSERT INTO user_roles VALUES ('${U.superAdmin}', 'super_admin');`);
  await db.exec(ADDON);
  await db.exec(`INSERT INTO book_club_addons (book_club_id, addon_id, config) SELECT '${CLUB}', id, '{"daily_regenerations": 1, "edition_budget_usd": 0.5}' FROM addon_registry WHERE slug = 'gazette-voice'`);
  run = /** @type {any} */ (await one(`INSERT INTO gazette_voice_runs (club_id, week, lang, kind, budget_usd, cost_usd, status) VALUES ($1, '2026-W46', 'en', 'edition', 0.5, 0.071, 'done') RETURNING id`, [CLUB])).id;
  story = /** @type {any} */ (await one(`INSERT INTO gazette_voice_stories (club_id, week, paper_id, lang, state, headline, dept, body, question, run_id) VALUES ($1, '2026-W46', $2, 'en', 'ready', 'Plato', 'from the a-b-c dept.', $3, 'So?', $4) RETURNING id`, [CLUB, PAPER, BODY, run])).id;
  await db.query(`INSERT INTO gazette_voice_story_revisions (story_id, revision, kind, summary, who, fields) SELECT id, 1, 'written', 'Written', 'desk', gazette_voice_story_fields(s) FROM gazette_voice_stories s WHERE id = $1`, [story]);
  await db.query(`INSERT INTO gazette_voice_calls (club_id, run_id, stage, lang, model, cost_usd, ms, status, request, reply) VALUES ($1, $2, 'write', 'en', 'claude-sonnet-5', 0.031, 21400, 'ok', '{"system":"HOUSE RULES","prompt":"PAPER 9: x"}', '{"text":"{}"}')`, [CLUB, run]);
});

describe('who manages', () => {
  it('owner, admin (as moderator), moderator and super admin manage; members and outsiders do not', async () => {
    const can = async (/** @type {string} */ u) => /** @type {any} */ (await one('SELECT gazette_voice_can_manage($1, $2) AS v', [CLUB, u])).v;
    expect(await Promise.all([U.owner, U.admin, U.mod, U.superAdmin].map(can))).toEqual([true, true, true, true]);
    expect(await Promise.all([U.m1, U.outsider, U.otherOwner, null].map((u) => can(/** @type {any} */ (u))))).toEqual([false, false, false, false]);
  });
  it('the console answers managers only, and only for their own club', async () => {
    expect(await api('api_gazette_voice_ops_summary', [U.mod, CLUB, '2026-W46'])).toMatchObject({ ok: true, calls: 1, stories_ready: 1, edition_cost_usd: 0.071, cap_usd: 0.5 });
    expect(await api('api_gazette_voice_ops_summary', [U.m1, CLUB, '2026-W46'])).toEqual({ ok: false, reason: 'not_club_manager' });
    expect(await api('api_gazette_voice_ops_summary', [U.otherOwner, CLUB, '2026-W46'])).toEqual({ ok: false, reason: 'not_club_manager' });
    const callId = /** @type {any} */ (await one('SELECT id FROM gazette_voice_calls LIMIT 1')).id;
    expect((await api('api_gazette_voice_call', [U.owner, callId])).call.request.system).toBe('HOUSE RULES');
    expect(await api('api_gazette_voice_call', [U.otherOwner, callId])).toEqual({ ok: false, reason: 'not_club_manager' });
  });
  it('every manager function refuses an outsider and another club\'s owner (never NULL, never ok)', async () => {
    const fix = (await api('api_gazette_voice_fix_create', [U.m1, story, 'fact', null, 'x', null, null, null])).fix_id;
    const callId = /** @type {any} */ (await one('SELECT id FROM gazette_voice_calls LIMIT 1')).id;
    const rule = /** @type {any} */ (await one(`INSERT INTO gazette_voice_learned (club_id, lang, text) VALUES ($1, 'en', 'A rule here.') RETURNING id`, [CLUB])).id;
    for (const who of [U.outsider, U.otherOwner, U.m1, null]) {
      const calls = [
        ['api_gazette_voice_ops_summary', [who, CLUB, '2026-W46']], ['api_gazette_voice_runs', [who, CLUB, null, 20]], ['api_gazette_voice_calls', [who, CLUB, null, null, null, null, 50]],
        ['api_gazette_voice_call', [who, callId]], ['api_gazette_voice_prompts', [who, CLUB, 'write', 'en']], ['api_gazette_voice_prompt_version', [who, CLUB, 'write', 'en', 'A voice that is long enough.', null]],
        ['api_gazette_voice_prompt_default', [who, CLUB, 'write', 'en', 1]], ['api_gazette_voice_learned_update', [who, rule, null, true, null]], ['api_gazette_voice_term_label', [who, CLUB, 'x', 'easy']],
        ['api_gazette_voice_fix_action', [who, fix, 'reject', null, null, null]], ['api_gazette_voice_story_undo', [who, story, 1]],
      ];
      for (const [fn, args] of /** @type {Array<[string, any[]]>} */ (calls)) {
        const r = await api(fn, args);
        expect(r, `${fn} as ${who}`).toEqual({ ok: false, reason: 'not_club_manager' });
      }
    }
  });
  it('only the system actor (the API gateway) may call the functions', async () => {
    await db.exec(`SET test.system = 'off'`);
    expect(await api('api_gazette_voice_ops_summary', [U.owner, CLUB, '2026-W46'])).toEqual({ ok: false, reason: 'forbidden_not_system' });
  });
});

describe('member fixes', () => {
  it('a wording fix the API marks as safe applies itself, as a new revision, logged as automatic', async () => {
    const r = await api('api_gazette_voice_fix_create', [U.m1, story, 'wording', 'trail far behind', 'lag well behind', null, null, apply()]);
    expect(r).toMatchObject({ ok: true, state: 'applied', revision: 2 });
    expect(/** @type {any} */ (await one('SELECT body FROM gazette_voice_stories WHERE id = $1', [story])).body).toContain('lag well behind');
    const h = await api('api_gazette_voice_history', [U.m1, story]);
    expect(h.revisions[0]).toMatchObject({ revision: 2, kind: 'fix_applied', who: 'automatic', undoable: false });
    expect((await api('api_gazette_voice_history', [U.mod, story])).revisions[1]).toMatchObject({ revision: 1, undoable: true });
  });
  it('at most three fixes a day apply themselves for one member; the fourth waits', async () => {
    for (let i = 0; i < 3; i++) expect((await api('api_gazette_voice_fix_create', [U.m1, story, 'wording', 'a', `b${i}`, null, null, apply()])).state).toBe('applied');
    expect((await api('api_gazette_voice_fix_create', [U.m1, story, 'wording', 'a', 'b4', null, null, apply()])).state).toBe('waiting');
  });
  it('one open fix per story per member, and 10 a day', async () => {
    expect((await api('api_gazette_voice_fix_create', [U.m1, story, 'fact', 'x', 'y', null, null, null])).state).toBe('waiting');
    expect(await api('api_gazette_voice_fix_create', [U.m1, story, 'link', 'x', 'z', null, null, null])).toEqual({ ok: false, reason: 'one_open_fix_per_story' });
    for (let i = 0; i < 9; i++) await db.query(`INSERT INTO gazette_voice_fixes (story_id, club_id, member_id, kind, replacement, state) VALUES ($1, $2, $3, 'other', 'x', 'rejected')`, [story, CLUB, U.m2]);
    expect((await api('api_gazette_voice_fix_create', [U.m2, story, 'other', null, 'tenth', null, null, null])).ok).toBe(true);
    await db.query(`UPDATE gazette_voice_fixes SET state = 'rejected' WHERE member_id = $1`, [U.m2]);
    expect(await api('api_gazette_voice_fix_create', [U.m2, story, 'other', null, 'eleventh', null, null, null])).toEqual({ ok: false, reason: 'daily_limit' });
  });
  it('refuses outsiders, em dashes, over-long text and unknown kinds', async () => {
    expect(await api('api_gazette_voice_fix_create', [U.outsider, story, 'fact', null, 'x', null, null, null])).toEqual({ ok: false, reason: 'not_club_member' });
    expect(await api('api_gazette_voice_fix_create', [U.m1, story, 'wording', null, `a ${String.fromCharCode(8212)} b`, null, null, null])).toMatchObject({ reason: 'validation_failed', field: 'em_dash' });
    expect(await api('api_gazette_voice_fix_create', [U.m1, story, 'wording', null, 'x'.repeat(501), null, null, null])).toMatchObject({ field: 'too_long' });
    expect(await api('api_gazette_voice_fix_create', [U.m1, story, 'opinion', null, 'x', null, null, null])).toMatchObject({ field: 'kind' });
  });
  it('three established members flagging fact or tone show the plain story; a member of one day does not count', async () => {
    await api('api_gazette_voice_fix_create', [U.m1, story, 'fact', null, 'wrong', null, null, null]);
    await api('api_gazette_voice_fix_create', [U.m2, story, 'tone', null, 'mean', null, null, null]);
    await api('api_gazette_voice_fix_create', [U.fresh, story, 'fact', null, 'wrong too', null, null, null]);
    expect(/** @type {any} */ (await one('SELECT flagged_plain FROM gazette_voice_stories WHERE id = $1', [story])).flagged_plain).toBe(false);
    await api('api_gazette_voice_fix_create', [U.m3, story, 'fact', null, 'wrong', null, null, null]);
    expect(/** @type {any} */ (await one('SELECT flagged_plain FROM gazette_voice_stories WHERE id = $1', [story])).flagged_plain).toBe(true);
    expect((await api('api_gazette_voice_ops_summary', [U.owner, CLUB, '2026-W46'])).stories_plain).toBe(1);
  });
});

describe('manager actions', () => {
  it('apply, then undo, brings the old words back as a new revision', async () => {
    const fix = (await api('api_gazette_voice_fix_create', [U.m1, story, 'fact', 'trail far behind', 'lag well behind', null, null, null])).fix_id;
    expect(await api('api_gazette_voice_fix_action', [U.m1, fix, 'apply', null, null, apply()])).toEqual({ ok: false, reason: 'not_club_manager' });
    expect(await api('api_gazette_voice_fix_action', [U.mod, fix, 'apply', 'Thanks', null, apply()])).toMatchObject({ ok: true, state: 'applied', revision: 2 });
    expect(await api('api_gazette_voice_fix_action', [U.mod, fix, 'undo', null, null, null])).toMatchObject({ ok: true, state: 'undone' });
    const s = /** @type {any} */ (await one('SELECT body, revision FROM gazette_voice_stories WHERE id = $1', [story]));
    expect(s).toEqual({ body: BODY, revision: 3 });
  });
  it('learn turns a fix into a rule; reject keeps a reply; regenerate is limited per day', async () => {
    const f1 = (await api('api_gazette_voice_fix_create', [U.m1, story, 'fact', null, 'Name all authors', null, null, null])).fix_id;
    const l = await api('api_gazette_voice_fix_action', [U.owner, f1, 'learn', null, 'Name every author when a paper has three or fewer.', null]);
    expect(l.ok).toBe(true);
    expect((await api('api_gazette_voice_prompts', [U.owner, CLUB, 'write', 'en'])).learned[0]).toMatchObject({ text: 'Name every author when a paper has three or fewer.', from_fix: f1 });
    expect(await api('api_gazette_voice_fix_action', [U.owner, f1, 'reject', 'Already fine', null, null])).toMatchObject({ state: 'rejected' });
    const f2 = (await api('api_gazette_voice_fix_create', [U.m2, story, 'fact', null, 'x', null, null, null])).fix_id;
    await db.query(`INSERT INTO gazette_voice_runs (club_id, week, lang, kind, budget_usd) VALUES ($1, '2026-W46', 'en', 'regenerate', 0.01)`, [CLUB]);
    expect(await api('api_gazette_voice_fix_action', [U.owner, f2, 'regenerate', null, null, null])).toEqual({ ok: false, reason: 'daily_regeneration_limit' });
  });
  it('the worker saves a regenerated story and closes the fix', async () => {
    const f = (await api('api_gazette_voice_fix_create', [U.m1, story, 'fact', null, 'x', null, null, null])).fix_id;
    expect((await api('api_gazette_voice_fix_action', [U.owner, f, 'regenerate', null, null, null])).state).toBe('regenerating');
    const rev = /** @type {any} */ (await one(`SELECT gazette_voice_save_revision($1, 'regenerated', 'Rewritten with Fix', $2, $3) AS v`, [story, JSON.stringify({ body: 'New body.' }), f])).v;
    expect(rev).toBe(2);
    expect(/** @type {any} */ (await one('SELECT state FROM gazette_voice_fixes WHERE id = $1', [f])).state).toBe('regenerated');
  });
  it('trial stories live in their own table and can never reach the Gazette', async () => {
    const trial = /** @type {any} */ (await one(`INSERT INTO gazette_voice_runs (club_id, week, lang, kind, budget_usd) VALUES ($1, '2026-W46', 'en', 'trial', 0.02) RETURNING id`, [CLUB])).id;
    await db.query(`INSERT INTO gazette_voice_trial_stories (run_id, paper_id, lang, story) VALUES ($1, $2, 'en', '{"headline":"Trial"}')`, [trial, PAPER]);
    expect(/** @type {any} */ (await one(`SELECT count(*)::int AS n FROM gazette_voice_stories WHERE headline = 'Trial'`)).n).toBe(0);
  });
});

describe('prompts and labels', () => {
  it('club voice versions: new, unchanged refused, too short refused, default and roll back', async () => {
    expect(await api('api_gazette_voice_prompt_version', [U.mod, CLUB, 'write', 'en', 'Puns welcome, one per story at most.', 'v1'])).toEqual({ ok: true, version: 1 });
    expect(await api('api_gazette_voice_prompt_version', [U.mod, CLUB, 'write', 'en', 'Puns welcome, one per story at most.', null])).toEqual({ ok: false, reason: 'unchanged' });
    expect(await api('api_gazette_voice_prompt_version', [U.mod, CLUB, 'write', 'en', 'Too short', null])).toMatchObject({ field: 'voice' });
    expect(await api('api_gazette_voice_prompt_version', [U.m1, CLUB, 'write', 'en', 'Members cannot change the voice at all.', null])).toEqual({ ok: false, reason: 'not_club_manager' });
    await api('api_gazette_voice_prompt_version', [U.mod, CLUB, 'write', 'en', 'Go easy on AGI hype, prefer concrete details.', 'v2']);
    expect(await api('api_gazette_voice_prompt_default', [U.owner, CLUB, 'write', 'en', 2])).toEqual({ ok: true, default_version: 2 });
    expect(await api('api_gazette_voice_prompt_default', [U.owner, CLUB, 'write', 'en', 1])).toEqual({ ok: true, default_version: 1 });
    expect(await api('api_gazette_voice_prompt_default', [U.owner, CLUB, 'write', 'en', 9])).toEqual({ ok: false, reason: 'not_found' });
  });
  it('a manager label wins over the level step, and the step can update its own labels', async () => {
    await one(`SELECT gazette_voice_save_step_labels($1, '{"quantization":"easy","kl-divergence":"advanced"}') AS n`, [CLUB]);
    await api('api_gazette_voice_term_label', [U.mod, CLUB, 'quantization', 'advanced']);
    await one(`SELECT gazette_voice_save_step_labels($1, '{"quantization":"expert","kl-divergence":"expert"}') AS n`, [CLUB]);
    const rows = (await db.query('SELECT term_slug, level, source FROM gazette_voice_term_labels ORDER BY term_slug')).rows;
    expect(rows).toEqual([{ term_slug: 'kl-divergence', level: 'expert', source: 'step' }, { term_slug: 'quantization', level: 'advanced', source: 'manager' }]);
  });
  it('reader preferences', async () => {
    expect(await api('api_gazette_voice_prefs_get', [U.m1])).toEqual({ ok: true, highlight: true, levels: ['easy', 'advanced', 'expert'] });
    expect(await api('api_gazette_voice_prefs_put', [U.m1, false, ['easy']])).toEqual({ ok: true, highlight: false, levels: ['easy'] });
    expect(await api('api_gazette_voice_prefs_put', [U.m1, true, ['hard']])).toMatchObject({ reason: 'validation_failed' });
  });
});

describe('logs', () => {
  it('erasing a member removes their fix text, also from logged prompts', async () => {
    const secret = 'my very personal wording suggestion';
    await api('api_gazette_voice_fix_create', [U.m1, story, 'fact', null, secret, 'because of my reasons here', null, null]);
    await db.query(`INSERT INTO gazette_voice_calls (club_id, run_id, stage, lang, model, status, request, reply) VALUES ($1, $2, 'rewrite', 'en', 'm', 'ok', $3, '{"text":""}')`,
      [CLUB, run, JSON.stringify({ system: 'S', prompt: `READER CORRECTIONS:\n- "${secret}" (because of my reasons here)` })]);
    const r = /** @type {any} */ (await one('SELECT gazette_voice_erase_member($1) AS r', [U.m1])).r;
    expect(r).toMatchObject({ fixes: 1, calls: 2 });
    const req = /** @type {any} */ (await one(`SELECT request FROM gazette_voice_calls WHERE stage = 'rewrite'`)).request;
    expect(req.prompt).toBe('READER CORRECTIONS:\n- "[removed]" ([removed])');
    expect(/** @type {any} */ (await one('SELECT member_id, replacement FROM gazette_voice_fixes')).replacement).toBe('[removed]');
  });
  it('archiving moves only bodies older than 90 days', async () => {
    await db.query(`INSERT INTO gazette_voice_calls (club_id, run_id, stage, lang, model, status, request, reply, created_at) VALUES ($1, $2, 'scout', 'en', 'm', 'ok', '{"system":"old"}', '{"text":"old"}', now() - interval '100 days')`, [CLUB, run]);
    const ids = (await db.query('SELECT id FROM gazette_voice_calls ORDER BY id')).rows.map((/** @type {any} */ x) => Number(x.id));
    expect(/** @type {any} */ (await one('SELECT gazette_voice_calls_archived($1, $2) AS n', [ids, 'gazette-voice/2026-W46/run.json.gz'])).n).toBe(1);
    expect((await db.query('SELECT count(*)::int AS n FROM gazette_voice_calls WHERE request IS NULL')).rows[0]).toEqual({ n: 1 });
  });
});
