// @ts-check
/**
 * The Week in Numbers: up to five striking figures from the week's published stories, each with a plain line.
 * One cheap call. A figure is kept only when it appears in the story text and in a claim the Skeptic traced to
 * the paper, so the box never prints a number the desk did not check.
 */
import { buildSystem } from './layers.mjs';
import { parseModelJson } from './json.mjs';
import { createBudget, estimateUsd } from './budget.mjs';
import { callRecord } from './calllog.mjs';
import { EM_DASH_RE, latinDigits } from './text.mjs';
import { HYPE } from './checks.mjs';

/** @typedef {{ n: number, paperId: string, headline: string, body: string, claims: Array<{ text: string, status: string }> }} NumbersStory */
/** @typedef {{ paper: number, paperId: string, figure: string, label: string }} WeekNumber */

export const NUMBERS_MAX = 5;
export const LABEL_MAX = 90;

const plain = (/** @type {string} */ s) => s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1');
const hasDigit = (/** @type {string} */ s) => /\d/.test(latinDigits(s));
/** Traced claims that carry a number, the only ones a figure may come from. @param {NumbersStory} s */
export const checkedClaims = (s) => s.claims.filter((c) => c.status === 'supported' && hasDigit(c.text) && !/^link anchor/i.test(c.text));

/** @param {NumbersStory[]} stories */
export function numbersData(stories) {
  return stories.filter((s) => checkedClaims(s).length).map((s) => [
    `STORY ${s.n}: ${s.headline}`,
    plain(s.body),
    'CHECKED CLAIMS:',
    ...checkedClaims(s).map((c) => `- ${c.text}`),
  ].join('\n')).join('\n\n');
}

/**
 * @param {string} text model reply
 * @param {NumbersStory[]} stories
 * @returns {WeekNumber[]}
 */
export function parseNumbers(text, stories) {
  const j = parseModelJson(text);
  /** @type {WeekNumber[]} */ const out = [];
  const seen = new Set();
  for (const x of Array.isArray(j?.numbers) ? j.numbers : []) {
    const s = stories.find((y) => y.n === Number(x?.paper));
    const figure = String(x?.figure ?? '').trim();
    const label = String(x?.label ?? '').trim();
    if (!s || !figure || !hasDigit(figure) || figure.length > 16 || !label || label.length > LABEL_MAX) continue;
    if (EM_DASH_RE.test(label) || HYPE.some((h) => label.toLowerCase().includes(h))) continue;
    const digits = latinDigits(figure).match(/\d+(?:[.,]\d+)?/)?.[0] ?? '';
    if (!digits || !latinDigits(plain(s.body)).includes(digits)) continue;
    if (!checkedClaims(s).some((c) => latinDigits(c.text).includes(digits))) continue;
    const key = `${s.n}:${digits}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ paper: s.n, paperId: s.paperId, figure, label });
    if (out.length >= NUMBERS_MAX) break;
  }
  return out;
}

/**
 * @param {{ runId: string, club: { masthead: string, name: string, finance: boolean }, lang: import('./types.mjs').Lang,
 *   stories: NumbersStory[], config: { cheapModel: string, rates: Record<string, import('./budget.mjs').Rate>, budgetUsd?: number },
 *   prompts: { frame: string, stages: Record<string, string> }, deps: import('./types.mjs').PipelineDeps }} a
 * @returns {Promise<WeekNumber[]>}
 */
export async function runNumbers({ runId, club, lang, stories, config, prompts, deps }) {
  const data = numbersData(stories);
  if (!data || !prompts.stages.numbers) return [];
  const budget = createBudget(config.budgetUsd ?? 0.02);
  const rate = config.rates[config.cheapModel] ?? { in: 0.0003, out: 0.0011 };
  const req = { system: buildSystem({ frame: prompts.frame, stage: prompts.stages.numbers, vars: { masthead: club.masthead, club_name: club.name, finance_rule: '' } }).system, prompt: data };
  const full = { model: config.cheapModel, ...req, stage: 'numbers', maxTokens: 8000, reasoning: /** @type {'low'} */ ('low') };
  if (!budget.canAfford(estimateUsd(req, rate, 600))) { await deps.logCall(callRecord({ runId, storyKey: null, lang, req: full, reply: null, status: 'refused', error: 'over budget', at: deps.now() })); return []; }
  let text;
  try { const r = await deps.callModel(full); await deps.logCall(callRecord({ runId, storyKey: null, lang, req: full, reply: r, status: 'ok', at: deps.now() })); text = r.text; }
  catch (e) { await deps.logCall(callRecord({ runId, storyKey: null, lang, req: full, reply: null, status: 'error', error: String(e), at: deps.now() })); return []; }
  try { return parseNumbers(text, stories); } catch { return []; }
}
