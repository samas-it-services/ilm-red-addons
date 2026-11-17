// @ts-check
/**
 * The day 3 and day 10 Update: gather again, keep only items not seen before, let Scout judge them, and
 * write one Update sentence per paper that has something notable. Nothing above the Update is rewritten.
 */
import { gatherAll } from './gather/index.mjs';
import { checkLinks } from './links.mjs';
import { buildSystem } from './layers.mjs';
import { scoutData, parseScout } from './scout.mjs';
import { parseModelJson } from './json.mjs';
import { createBudget, estimateUsd } from './budget.mjs';
import { callRecord } from './calllog.mjs';
import { linksIn, wordCount, longestCopiedRun, numbersIn, latinDigits, EM_DASH_RE } from './text.mjs';
import { HYPE } from './checks.mjs';

/** @typedef {import('./types.mjs').Paper} Paper @typedef {import('./types.mjs').KeptSource} KeptSource @typedef {import('./types.mjs').Lang} Lang */

export const UPDATE_MAX_WORDS = 40;

/**
 * @param {string} text @param {KeptSource[]} fresh @param {Lang} lang
 * @returns {string[]} problems, empty when the sentence is fine
 */
export function checkUpdate(text, fresh, lang) {
  /** @type {string[]} */ const p = [];
  const allowed = new Set(fresh.flatMap((k) => [k.item.url, k.item.linksTo].filter(Boolean)));
  const links = linksIn(text);
  if (!links.length) p.push('no_link');
  for (const l of links) if (!allowed.has(l.url)) p.push(`link_not_new:${l.url}`);
  if (wordCount(text) > (lang === 'ur' ? 56 : UPDATE_MAX_WORDS)) p.push('too_long');
  if (EM_DASH_RE.test(text)) p.push('em_dash');
  for (const h of HYPE) if (text.toLowerCase().includes(h)) p.push(`hype:${h}`);
  const srcTexts = fresh.flatMap((k) => [k.item.title, k.item.snippet ?? '']);
  if (longestCopiedRun(text, srcTexts).n > 20) p.push('copied');
  const facts = latinDigits(fresh.map((k) => `${k.item.title} ${k.item.snippet ?? ''} ${k.item.points ?? ''} ${k.item.comments ?? ''} ${k.item.stars ?? ''} ${k.item.count ?? ''}`).join(' '));
  for (const n of numbersIn(text)) if (!facts.includes(n)) p.push(`number:${n}`);
  return p;
}

/**
 * @param {Object} a
 * @param {string} a.runId
 * @param {{ masthead: string, name: string, finance: boolean }} a.club
 * @param {Lang} a.lang
 * @param {Array<{ paper: Paper, knownUrls: string[] }>} a.items   papers with every URL already gathered for them
 * @param {{ sources: import('./types.mjs').Source[], cheapModel: string, budgetUsd: number, rates: Record<string, import('./budget.mjs').Rate> }} a.config
 * @param {{ frame: string, stages: Record<string, string> }} a.prompts
 * @param {import('./types.mjs').PipelineDeps} a.deps
 * @returns {Promise<Array<{ paperId: string, update: string|null, sources: KeptSource[], why: string }>>}
 */
export async function runUpdate({ runId, club, lang, items, config, prompts, deps }) {
  const budget = createBudget(config.budgetUsd);
  const vars = { masthead: club.masthead, club_name: club.name, max_items: '3', finance_rule: '' };
  const rate = config.rates[config.cheapModel] ?? { in: 0.0003, out: 0.0011 };
  /** @param {string} stage @param {{ system: string, prompt: string }} req @param {number} out */
  const call = async (stage, req, out) => {
    const full = { model: config.cheapModel, ...req, stage, maxTokens: 4000, reasoning: /** @type {'low'} */ ('low') };
    if (!budget.canAfford(estimateUsd(req, rate, out))) { await deps.logCall(callRecord({ runId, storyKey: null, lang, req: full, reply: null, status: 'refused', error: 'over budget', at: deps.now() })); return null; }
    try { const r = await deps.callModel(full); budget.add(r.costUsd); await deps.logCall(callRecord({ runId, storyKey: null, lang, req: full, reply: r, status: 'ok', at: deps.now() })); return r.text; }
    catch (e) { await deps.logCall(callRecord({ runId, storyKey: null, lang, req: full, reply: null, status: 'error', error: String(e), at: deps.now() })); return null; }
  };
  /** @type {Array<{ paper: Paper, items: import('./types.mjs').CoverageItem[] }>} */
  const withNew = [];
  /** @type {Map<string, { paperId: string, update: string|null, sources: KeptSource[], why: string }>} */
  const out = new Map(items.map(({ paper }) => [paper.id, { paperId: paper.id, update: null, sources: [], why: 'nothing new' }]));
  for (const { paper, knownUrls } of items) {
    const g = await gatherAll(paper, deps.net, config.sources);
    const known = new Set(knownUrls);
    const fresh = (await checkLinks(g.items.filter((i) => !known.has(i.url)), deps.net)).ok;
    if (fresh.length) withNew.push({ paper, items: fresh });
  }
  if (!withNew.length) return [...out.values()];
  const scoutText = await call('scout', { system: buildSystem({ frame: prompts.frame, stage: prompts.stages.scout, vars }).system, prompt: scoutData(withNew) }, 200 * withNew.length);
  if (scoutText === null) return [...out.values()];
  /** @type {Map<number, KeptSource[]>} */ let kept = new Map();
  try { kept = parseScout(scoutText, withNew, 3); } catch { return [...out.values()]; }
  const notable = withNew.filter(({ paper }) => (kept.get(paper.n) ?? []).some((k) => k.notable));
  if (!notable.length) return [...out.values()];
  const data = notable.map(({ paper }) => [`PAPER ${paper.n}: ${paper.title}`, 'NEW SOURCES:', ...(kept.get(paper.n) ?? []).filter((k) => k.notable).map((k, i) => `[N${i + 1}] ${k.kind} | ${k.item.outlet ?? k.item.source} | ${k.item.title} | ${k.adds} | ${k.item.url}`)].join('\n')).join('\n\n');
  const text = await call('update', { system: buildSystem({ frame: prompts.frame, stage: prompts.stages.update, vars }).system, prompt: data }, 80 * notable.length);
  if (text === null) return [...out.values()];
  let j;
  try { j = parseModelJson(text); } catch { return [...out.values()]; }
  for (const u of Array.isArray(j?.updates) ? j.updates : []) {
    const entry = notable.find((x) => x.paper.n === Number(u?.paper));
    if (!entry || typeof u.update !== 'string') continue;
    const fresh = (kept.get(entry.paper.n) ?? []).filter((k) => k.notable);
    const problems = checkUpdate(u.update, fresh, lang);
    out.set(entry.paper.id, problems.length ? { paperId: entry.paper.id, update: null, sources: [], why: `refused: ${problems.join(', ')}` } : { paperId: entry.paper.id, update: u.update.trim(), sources: fresh, why: 'notable new coverage' });
  }
  return [...out.values()];
}
