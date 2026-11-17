// @ts-check
/** Scout: keeps the gathered items that are really about each paper. One call per batch of papers. */
import { parseModelJson } from './json.mjs';
import { clip } from './gather/util.mjs';

/** @typedef {import('./types.mjs').Paper} Paper @typedef {import('./types.mjs').CoverageItem} CoverageItem @typedef {import('./types.mjs').KeptSource} KeptSource */

export const KINDS = ['news', 'discussion', 'code', 'video', 'citing_paper', 'votes', 'prior_work'];
export const STANCES = ['enthusiastic', 'neutral', 'skeptical', 'critical'];

/** @param {CoverageItem} it */
function describe(it) {
  const bits = [it.source, it.kind, it.exact ? 'exact match' : 'weak match'];
  if (it.points !== undefined) bits.push(`${it.points} points`);
  if (it.comments !== undefined) bits.push(`${it.comments} comments`);
  if (it.stars !== undefined) bits.push(`${it.stars} stars`);
  if (it.count !== undefined) bits.push(`${it.count} citations`);
  if (it.outlet) bits.push(it.outlet);
  if (it.publishedAt) bits.push(it.publishedAt.slice(0, 10));
  return bits.join(', ');
}

/**
 * @param {Array<{ paper: Paper, items: CoverageItem[] }>} batch
 * @returns {string}
 */
export function scoutData(batch) {
  return batch.map(({ paper, items }) => [
    `PAPER ${paper.n}: ${paper.title}`,
    `ABSTRACT: ${clip(paper.abstract, 1800)}`,
    'ITEMS:',
    ...items.map((it, i) => `[${i + 1}] (${describe(it)}) ${clip(it.title, 160)}${it.snippet ? ` | ${clip(it.snippet, 240)}` : ''} | ${it.url}`),
  ].join('\n')).join('\n\n');
}

/**
 * @param {string} text model reply
 * @param {Array<{ paper: Paper, items: CoverageItem[] }>} batch
 * @param {number} max
 * @returns {Map<number, KeptSource[]>} paper number to kept sources
 */
export function parseScout(text, batch, max = 6) {
  const j = parseModelJson(text);
  /** @type {Map<number, KeptSource[]>} */
  const out = new Map(batch.map(({ paper }) => [paper.n, []]));
  for (const p of Array.isArray(j?.papers) ? j.papers : []) {
    const entry = batch.find((b) => b.paper.n === Number(p?.paper));
    if (!entry) continue;
    /** @type {KeptSource[]} */
    const kept = [];
    const seen = new Set();
    for (const k of Array.isArray(p.keep) ? p.keep : []) {
      const idx = Number(k?.item) - 1;
      const item = entry.items[idx];
      if (!item || seen.has(idx) || kept.length >= max) continue;
      seen.add(idx);
      kept.push({
        item,
        kind: KINDS.includes(k.kind) ? k.kind : item.kind,
        adds: typeof k.adds === 'string' ? clip(k.adds.trim(), 240) : '',
        stance: STANCES.includes(k.stance) ? k.stance : 'neutral',
        notable: k.notable === true,
      });
    }
    out.set(entry.paper.n, kept);
  }
  return out;
}
