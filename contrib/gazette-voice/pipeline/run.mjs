// @ts-check
/**
 * One edition run for one language: gather, link check, Scout, write, checks, repair and one rewrite,
 * council, terms, store. Every model call goes through `call()`, which checks the budget first, logs the
 * exact request and reply, and adds the cost.
 */
import { gatherAll } from './gather/index.mjs';
import { checkLinks } from './links.mjs';
import { buildSystem } from './layers.mjs';
import { scoutData, parseScout } from './scout.mjs';
import { writeData, parseStories, allowedUrls, sourceTexts } from './write.mjs';
import { checkStory, repairLength, limitsFor } from './checks.mjs';
import { skepticData, editorData, parseVerdicts, applyFixPairs, verdictKey, ARBITER_TASK, parseArbiter } from './council.mjs';
import { createBudget, estimateUsd } from './budget.mjs';
import { callRecord } from './calllog.mjs';
import { matchTerms } from './terms.mjs';
import { labelTerms } from './levels.mjs';

/** @typedef {import('./types.mjs').Paper} Paper @typedef {import('./types.mjs').KeptSource} KeptSource @typedef {import('./types.mjs').Story} Story @typedef {import('./types.mjs').Lang} Lang @typedef {import('./types.mjs').CoverageItem} CoverageItem @typedef {import('./types.mjs').Source} Source */

export const BATCH = 5;
export const COVERAGE_TTL_MS = 24 * 3600 * 1000;
/** Expected output tokens per paper, for estimates. */
const OUT_PER_PAPER = { scout: 220, write: 450, rewrite: 450, skeptic: 400, editor: 160, arbiter: 60, level: 40 };

/**
 * What the run needs from ilm.red's database. The import step implements it over the real tables.
 * @typedef {Object} Store
 * @property {(paperId: string) => Promise<{ items: CoverageItem[], fetchedAt: string } | null>} getCoverage
 * @property {(paperId: string, items: CoverageItem[], notes: Array<{source: string, error: string}>, at: string) => Promise<void>} saveCoverage
 * @property {(key: string) => Promise<any | null>} getVerdict
 * @property {(key: string, v: any) => Promise<void>} putVerdict
 * @property {(slugs: string[]) => Promise<Map<string, import('./types.mjs').Level>>} getTermLabels
 * @property {(labels: Map<string, import('./types.mjs').Level>) => Promise<void>} saveTermLabels
 * @property {(rec: StoryRecord) => Promise<void>} saveStory
 *
 * @typedef {Object} StoryRecord
 * @property {string} runId
 * @property {string} paperId
 * @property {number} paperN
 * @property {Lang} lang
 * @property {'ready'|'plain'} state
 * @property {string|null} reason        why a story is plain
 * @property {Story|null} story
 * @property {KeptSource[]} sources
 * @property {any} checks
 * @property {{ skeptic: any, editor: any, arbiter: string|null }} verdicts
 * @property {Array<{ name: string, slug: string, level: import('./types.mjs').Level, start: number, end: number, hook: string|null }>} terms
 * @property {Array<{ stage: string, what: string }>} history
 *
 * @typedef {Object} RunConfig
 * @property {Source[]} sources
 * @property {string} writerModel
 * @property {string} cheapModel
 * @property {number} budgetUsd
 * @property {'short'|'standard'} [length]
 * @property {Record<string, import('./budget.mjs').Rate>} rates
 * @property {number} [arbiterTop]       arbiter only for papers numbered up to this rank in the edition (default 3)
 *
 * @typedef {Object} Prompts
 * @property {string} frame
 * @property {Record<string, string>} stages   scout, write.en, write.ur, rewrite, skeptic, editor, level
 * @property {Record<string, { text: string, version: string } | null>} voices   keyed by "write.en", "editor.en", ...
 * @property {Record<string, Array<{ id: string, text: string, pinned?: boolean }>>} learned  keyed by lang
 */

/**
 * @param {Object} a
 * @param {string} a.runId
 * @param {{ id: string, slug: string, name: string, masthead: string, finance: boolean }} a.club
 * @param {Lang} a.lang
 * @param {Paper[]} a.papers
 * @param {RunConfig} a.config
 * @param {Prompts} a.prompts
 * @param {Store} a.store
 * @param {import('./types.mjs').PipelineDeps} a.deps
 * @param {number} [a.spentUsd]  already spent this edition (another language's run)
 */
export async function runEdition({ runId, club, lang, papers, config, prompts, store, deps, spentUsd = 0 }) {
  const budget = createBudget(config.budgetUsd, spentUsd);
  const vars = { masthead: club.masthead, club_name: club.name, finance_rule: club.finance ? '9. Report what the research found. Never tell the reader to buy, sell, hold or invest, never promise a return, and never forecast the price of a named asset.' : '', min_words: '', max_words: '', max_items: '6' };
  const limits = limitsFor(lang, config.length);
  vars.min_words = String(limits.minWords);
  vars.max_words = String(limits.maxWords);
  /** @type {Map<number, StoryRecord>} */
  const records = new Map();
  /** @type {Map<number, Array<{ stage: string, what: string }>>} */
  const history = new Map(papers.map((p) => [p.n, []]));
  /** Mark a paper plain (its Easy story is shown) with the reason. @param {Paper} p @param {string} reason @param {any} [checks] */
  const plain = (p, reason, checks = null) => {
    records.set(p.n, { runId, paperId: p.id, paperN: p.n, lang, state: 'plain', reason, story: null, sources: [], checks, verdicts: { skeptic: null, editor: null, arbiter: null }, terms: [], history: history.get(p.n) ?? [] });
  };

  /**
   * One model call: budget check, log, cost.
   * @param {string} stage @param {string} model @param {{ system: string, prompt: string }} req @param {number} papersInCall @param {string|null} storyKey
   * @returns {Promise<string|null>} reply text, or null when refused by the budget or failed
   */
  let lastRefused = false;
  /**
   * @param {string} stage @param {string} model @param {{ system: string, prompt: string }} req @param {number} papersInCall @param {string|null} storyKey
   * @returns {Promise<string|null>}
   */
  async function call(stage, model, req, papersInCall, storyKey) {
    lastRefused = false;
    const rate = config.rates[model] ?? { in: 0.003, out: 0.015 };
    const est = estimateUsd(req, rate, OUT_PER_PAPER[/** @type {keyof typeof OUT_PER_PAPER} */ (stage)] * papersInCall);
    const full = { model, system: req.system, prompt: req.prompt, stage, maxTokens: 8000, reasoning: /** @type {'low'|'high'} */ (stage === 'skeptic' ? 'high' : 'low') };
    if (!budget.canAfford(est)) {
      lastRefused = true;
      await deps.logCall(callRecord({ runId, storyKey, lang, req: full, reply: null, status: 'refused', error: `over budget: estimate $${est.toFixed(4)}, remaining $${budget.remaining.toFixed(4)}`, at: deps.now() }));
      return null;
    }
    try {
      const reply = await deps.callModel(full);
      budget.add(reply.costUsd);
      await deps.logCall(callRecord({ runId, storyKey, lang, req: full, reply, status: 'ok', at: deps.now() }));
      return reply.text;
    } catch (e) {
      await deps.logCall(callRecord({ runId, storyKey, lang, req: full, reply: null, status: 'error', error: String(/** @type {Error} */ (e).message ?? e), at: deps.now() }));
      return null;
    }
  }
  const sys = (/** @type {string} */ stageKey, /** @type {string} */ voiceKey) => buildSystem({ frame: prompts.frame, stage: prompts.stages[stageKey], voice: prompts.voices[voiceKey] ?? null, learned: voiceKey.startsWith('write') ? prompts.learned[lang] ?? [] : [], vars });
  const chunks = (/** @type {any[]} */ xs) => Array.from({ length: Math.ceil(xs.length / BATCH) }, (_, i) => xs.slice(i * BATCH, i * BATCH + BATCH));

  // 1 and 2. Gather (cached for a day across languages and runs) and check links.
  /** @type {Map<number, CoverageItem[]>} */
  const coverage = new Map();
  const linkCache = new Map();
  for (const p of papers) {
    const cached = await store.getCoverage(p.id);
    let items;
    if (cached && deps.now().getTime() - new Date(cached.fetchedAt).getTime() < COVERAGE_TTL_MS) items = cached.items;
    else {
      const g = await gatherAll(p, deps.net, config.sources);
      items = (await checkLinks(g.items, deps.net, { cache: linkCache })).ok;
      await store.saveCoverage(p.id, items, g.notes, deps.now().toISOString());
    }
    coverage.set(p.n, items);
  }

  // 3. Scout, for papers that found anything.
  /** @type {Map<number, KeptSource[]>} */
  const kept = new Map(papers.map((p) => [p.n, []]));
  const withItems = papers.filter((p) => (coverage.get(p.n) ?? []).length > 0);
  for (const batch of chunks(withItems.map((p) => ({ paper: p, items: coverage.get(p.n) ?? [] })))) {
    const text = await call('scout', config.cheapModel, { system: buildSystem({ frame: prompts.frame, stage: prompts.stages.scout, vars }).system, prompt: scoutData(batch) }, batch.length, null);
    if (text === null) continue; // no Scout: these papers are written without outside sources
    try { for (const [n, ks] of parseScout(text, batch)) kept.set(n, ks); } catch { /* unreadable reply: no sources */ }
  }

  // 4. Write.
  const writeKey = `write.${lang}`;
  /** @type {Map<number, Story>} */
  const stories = new Map();
  for (const batch of chunks(papers)) {
    const text = await call('write', config.writerModel, { system: sys(writeKey, writeKey).system, prompt: writeData(batch.map((/** @type {Paper} */ p) => ({ paper: p, sources: kept.get(p.n) ?? [] })), lang) }, batch.length, null);
    if (text === null) { for (const p of batch) plain(p, lastRefused ? 'over_budget' : 'writer_failed'); continue; }
    try { for (const [n, s] of parseStories(text, batch.map((/** @type {Paper} */ p) => p.n))) stories.set(n, s); } catch { /* handled below */ }
    for (const p of batch) if (!stories.has(p.n) && !records.has(p.n)) plain(p, 'writer_unreadable');
  }

  // 5. Checks, length repair, one targeted rewrite.
  const ctxFor = (/** @type {Paper} */ p) => {
    const k = kept.get(p.n) ?? [];
    const st = sourceTexts(p, k);
    return { lang, allowedUrls: allowedUrls(p, k), paperUrl: p.url, sourceTexts: st.texts, factText: st.facts, finance: club.finance, length: config.length };
  };
  /** @type {Map<number, string[]>} */
  const failed = new Map();
  for (const p of papers) {
    let s = stories.get(p.n);
    if (!s) continue;
    history.get(p.n)?.push({ stage: 'write', what: `Written by ${config.writerModel}` });
    let r = checkStory(s, ctxFor(p));
    if (!r.ok && r.fails.some((f) => f.field === 'body' && f.code === 'too_long') && r.fails.every((f) => f.field === 'body' && f.code === 'too_long')) {
      const fixed = repairLength(s, ctxFor(p));
      if (fixed) { history.get(p.n)?.push({ stage: 'repair', what: `Shortened from ${r.stats.words} to ${checkStory(fixed, ctxFor(p)).stats.words} words` }); s = fixed; stories.set(p.n, s); r = checkStory(s, ctxFor(p)); }
    }
    if (!r.ok) failed.set(p.n, r.fails.map((f) => `${f.field}: ${f.code}${f.detail ? ` (${f.detail})` : ''}`));
  }
  const toRewrite = papers.filter((p) => failed.has(p.n));
  for (const batch of chunks(toRewrite)) {
    const text = await call('rewrite', config.writerModel, { system: sys('rewrite', writeKey).system, prompt: writeData(batch.map((/** @type {Paper} */ p) => ({ paper: p, sources: kept.get(p.n) ?? [] })), lang, { failed, stories }) }, batch.length, null);
    /** @type {Map<number, Story>} */
    let redo = new Map();
    try { if (text !== null) redo = parseStories(text, batch.map((/** @type {Paper} */ p) => p.n)); } catch { /* keep failing */ }
    for (const p of batch) {
      const s = redo.get(p.n);
      if (s && checkStory(s, ctxFor(p)).ok) { stories.set(p.n, s); history.get(p.n)?.push({ stage: 'rewrite', what: `Rewrote after: ${failed.get(p.n)?.join('; ')}` }); failed.delete(p.n); }
    }
  }
  for (const p of papers) if (failed.has(p.n)) { plain(p, 'checks_failed', failed.get(p.n)); stories.delete(p.n); }

  // 6. Council: Skeptic and Editor in batches; cached verdicts skip the call.
  const live = papers.filter((p) => stories.has(p.n));
  /** @type {Map<number, any>} */ const skeptic = new Map();
  /** @type {Map<number, any>} */ const editor = new Map();
  for (const [seat, stageKey, out] of /** @type {const} */ ([['skeptic', 'skeptic', skeptic], ['editor', 'editor', editor]])) {
    /** @type {Paper[]} */ const need = [];
    for (const p of live) {
      const v = await store.getVerdict(verdictKey(seat, /** @type {Story} */ (stories.get(p.n)), kept.get(p.n) ?? []));
      if (v) out.set(p.n, { ...v, cached: true }); else need.push(p);
    }
    for (const batch of chunks(need)) {
      const data = seat === 'skeptic'
        ? skepticData(batch.map((/** @type {Paper} */ p) => ({ paper: p, sources: kept.get(p.n) ?? [], story: /** @type {Story} */ (stories.get(p.n)) })))
        : editorData(batch.map((/** @type {Paper} */ p) => ({ paper: p, story: /** @type {Story} */ (stories.get(p.n)) })));
      const text = await call(seat, config.cheapModel, { system: sys(stageKey, `${stageKey}.${lang}`).system, prompt: data }, batch.length, null);
      if (text === null) continue;
      try {
        for (const [n, v] of parseVerdicts(text)) {
          if (!batch.some((/** @type {Paper} */ p) => p.n === n)) continue;
          out.set(n, v);
          await store.putVerdict(verdictKey(seat, /** @type {Story} */ (stories.get(n)), kept.get(n) ?? []), v);
        }
      } catch { /* missing verdicts handled below */ }
    }
  }
  /** @type {Paper[]} */ const disputed = [];
  for (const p of live) {
    let s = /** @type {Story} */ (stories.get(p.n));
    const sk = skeptic.get(p.n);
    const ed = editor.get(p.n);
    if (!sk) { plain(p, 'no_fact_check'); stories.delete(p.n); continue; }
    // Apply the seats' exact wording fixes when the result still passes the machine checks.
    let skFixed = false;
    let edFixed = false;
    for (const [seat, v] of /** @type {const} */ ([['skeptic', sk], ['editor', ed]])) {
      if (!v?.fixes?.length) continue;
      const a = applyFixPairs(s, v.fixes);
      if (a.applied.length === v.fixes.length && checkStory(a.story, ctxFor(p)).ok) {
        s = a.story;
        stories.set(p.n, s);
        history.get(p.n)?.push({ stage: seat, what: `${seat === 'skeptic' ? 'Fact check' : 'Editor'} changed ${a.applied.map((f) => `"${f.from}" to "${f.to}"`).join('; ')}` });
        if (seat === 'skeptic') skFixed = true; else edFixed = true;
      }
    }
    const skOk = sk.verdict === 'pass' || skFixed;
    const edOk = !ed || ed.verdict === 'pass' || edFixed;
    if (skOk && edOk) continue;
    if (!skOk && !edOk) { plain(p, 'council_failed'); stories.delete(p.n); continue; }
    disputed.push(p);
  }
  const arbiterTop = config.arbiterTop ?? 3;
  const ranked = [...papers].sort((a, b) => a.n - b.n).map((p) => p.n);
  const arbitrate = disputed.filter((p) => ranked.indexOf(p.n) < arbiterTop);
  for (const p of disputed) if (!arbitrate.includes(p)) { plain(p, 'council_split'); stories.delete(p.n); }
  /** @type {Map<number, string>} */ const arbiterOut = new Map();
  if (arbitrate.length) {
    const data = skepticData(arbitrate.map((p) => ({ paper: p, sources: kept.get(p.n) ?? [], story: /** @type {Story} */ (stories.get(p.n)) }))) + '\n\nREVIEWS:\n' + arbitrate.map((p) => `PAPER ${p.n}: skeptic ${JSON.stringify(skeptic.get(p.n))}; editor ${JSON.stringify(editor.get(p.n) ?? null)}`).join('\n');
    const text = await call('arbiter', config.writerModel, { system: buildSystem({ frame: prompts.frame, stage: ARBITER_TASK, vars }).system, prompt: data }, arbitrate.length, null);
    /** @type {Map<number, 'publish'|'plain'>} */ let dec = new Map();
    try { if (text !== null) dec = parseArbiter(text); } catch { /* plain */ }
    for (const p of arbitrate) {
      const d = dec.get(p.n) ?? 'plain';
      arbiterOut.set(p.n, d);
      if (d !== 'publish') { plain(p, 'arbiter_plain'); stories.delete(p.n); }
    }
  }

  // 7. Terms and their levels, then store.
  const finalPapers = papers.filter((p) => stories.has(p.n));
  const matched = new Map(finalPapers.map((p) => [p.n, matchTerms(/** @type {Story} */ (stories.get(p.n)).body, p.terms, lang)]));
  const labels = await labelTerms({
    terms: finalPapers.flatMap((p) => (matched.get(p.n) ?? []).map((m) => /** @type {import('./types.mjs').Term} */ (p.terms.find((t) => t.slug === m.slug)))),
    store, club, prompts, vars,
    call: (req, n) => call('level', config.cheapModel, req, n, null),
  });
  for (const p of finalPapers) {
    const s = /** @type {Story} */ (stories.get(p.n));
    const terms = (matched.get(p.n) ?? []).map((m) => ({ ...m, level: labels.get(m.slug) ?? 'advanced', hook: p.terms.find((t) => t.slug === m.slug)?.hook ?? null }));
    for (const t of terms) if (!t.hook) await deps.queueJob('enrich-term', t.slug, { reason: 'gazette-voice highlight' });
    records.set(p.n, { runId, paperId: p.id, paperN: p.n, lang, state: 'ready', reason: null, story: s, sources: kept.get(p.n) ?? [], checks: checkStory(s, ctxFor(p)).stats, verdicts: { skeptic: skeptic.get(p.n) ?? null, editor: editor.get(p.n) ?? null, arbiter: arbiterOut.get(p.n) ?? null }, terms, history: history.get(p.n) ?? [] });
  }
  for (const p of papers) {
    const rec = records.get(p.n);
    if (!rec) continue;
    if (rec.state === 'plain') rec.history = history.get(p.n) ?? [];
    await store.saveStory(rec);
  }
  return { records: papers.map((p) => /** @type {StoryRecord} */ (records.get(p.n))), spentUsd: budget.spent - spentUsd, budget };
}
