// @ts-check
/**
 * A scripted model for end-to-end tests: answers each stage the way the 16 Nov sample went.
 * Scout keeps the six sources the sample used; the writer returns the sample stories; both council seats
 * pass; the level step labels as in the mockup. Hooks let a test change any stage.
 */
import { scriptedModel } from '../../_sdk/fakes.mjs';
import { fixtureJson } from './helpers.mjs';

export const SAMPLE = fixtureJson('replies/sample-stories.json');
export const LEVELS = fixtureJson('replies/levels.json');

/** URLs the sample kept for paper 9 (paper 10 keeps none). */
export const KEPT_9 = [
  'https://news.ycombinator.com/item?id=47921601',
  'https://www.quantamagazine.org/distinct-ai-models-seem-to-converge-on-how-they-encode-reality-20260107/',
  'https://arxiv.org/abs/2602.14486',
  'https://github.com/ExplainableML/prh-closer-look',
  'https://news.ycombinator.com/item?id=50325454',
  'https://huggingface.co/papers/2611.12869',
];

/** Paper numbers named in a data prompt. @param {string} prompt */
export const papersIn = (prompt) => [...prompt.matchAll(/^PAPER (\d+):/gm)].map((m) => Number(m[1]));

/** @param {string} prompt @param {number} n @returns {Map<string, number>} url to item number, for one paper */
function itemsOf(prompt, n) {
  const sec = prompt.split(/^PAPER /m).find((s) => s.startsWith(`${n}:`)) ?? '';
  return new Map([...sec.matchAll(/^\[(\d+)\] .* \| (https:\/\/\S+)$/gm)].map((m) => [m[2], Number(m[1])]));
}

/**
 * @param {Partial<Record<'scout'|'write'|'rewrite'|'skeptic'|'editor'|'arbiter'|'level', (req: import('../../_sdk/types').ModelRequest) => string>>} [over]
 * @param {{ lang?: 'en'|'ur' }} [opt]
 */
export function sampleModel(over = {}, opt = {}) {
  return scriptedModel((req) => {
    const o = over[/** @type {keyof typeof over} */ (req.stage)];
    if (o) return o(req);
    const ns = papersIn(req.prompt);
    switch (req.stage) {
      case 'scout': return JSON.stringify({ papers: ns.map((n) => ({ paper: n, keep: n === 9 ? KEPT_9.map((u) => ({ item: itemsOf(req.prompt, n).get(u), kind: 'news', adds: 'context', stance: 'neutral', notable: true })).filter((k) => k.item) : [] })) });
      case 'write': return JSON.stringify({ stories: ns.map((n) => ({ paper: n, ...SAMPLE[opt.lang === 'ur' ? `${n}ur` : String(n)] })) });
      case 'skeptic': return JSON.stringify({ verdicts: ns.map((n) => ({ paper: n, verdict: 'pass', fixes: [] })) });
      case 'editor': return JSON.stringify({ verdicts: ns.map((n) => ({ paper: n, verdict: 'pass', score: 4, fixes: [] })) });
      case 'level': return JSON.stringify({ terms: [...req.prompt.matchAll(/^- ([a-z0-9-]+):/gm)].map((m) => ({ slug: m[1], level: LEVELS[m[1]] ?? 'advanced' })) });
      default: return '{}';
    }
  });
}

/** An in-memory store for runs. */
export function memoryStore() {
  /** @type {Map<string, any>} */ const coverage = new Map();
  /** @type {Map<string, any>} */ const verdicts = new Map();
  /** @type {Map<string, any>} */ const labels = new Map();
  /** @type {any[]} */ const stories = [];
  return {
    coverage, verdicts, labels, stories,
    /** @param {string} id */ getCoverage: async (id) => coverage.get(id) ?? null,
    /** @param {string} id @param {any[]} items @param {any[]} notes @param {string} at */ saveCoverage: async (id, items, notes, at) => { coverage.set(id, { items, notes, fetchedAt: at }); },
    /** @param {string} k */ getVerdict: async (k) => verdicts.get(k) ?? null,
    /** @param {string} k @param {any} v */ putVerdict: async (k, v) => { verdicts.set(k, v); },
    /** @param {string[]} slugs */ getTermLabels: async (slugs) => new Map(slugs.filter((s) => labels.has(s)).map((s) => [s, labels.get(s)])),
    /** @param {Map<string, any>} m */ saveTermLabels: async (m) => { for (const [k, v] of m) labels.set(k, v); },
    /** @param {any} r */ saveStory: async (r) => { stories.push(r); },
  };
}
