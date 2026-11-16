// @ts-check
/**
 * Hacker News through the Algolia search API (no key).
 * Exact: stories whose URL is this arXiv paper. Algolia's URL search is fuzzy (2611.12869 also returns
 * 2601.18692), so every hit is re-checked against the exact id. Topic: stories found by the paper's topic
 * words, marked weak for Scout to judge.
 */
import { isArxivUrlFor, titleOverlap } from './util.mjs';

const API = 'https://hn.algolia.com/api/v1/search';
const ITEM = 'https://news.ycombinator.com/item?id=';

/** @typedef {import('../types.mjs').Paper} Paper @typedef {import('../types.mjs').CoverageItem} CoverageItem */

/** @param {any} h @param {boolean} exact @returns {CoverageItem} */
const toItem = (h, exact) => ({
  source: 'hn', kind: 'discussion', url: `${ITEM}${h.objectID}`, title: String(h.title ?? ''),
  snippet: h.url ? `Links to ${h.url}` : undefined, linksTo: typeof h.url === 'string' && h.url.startsWith('https://') ? h.url : undefined, points: Number(h.points ?? 0), comments: Number(h.num_comments ?? 0),
  publishedAt: h.created_at ?? null, exact, weak: !exact,
});

/**
 * @param {Paper} paper
 * @param {import('../types.mjs').Net} net
 * @returns {Promise<CoverageItem[]>}
 */
export async function gatherHn(paper, net) {
  /** @type {Map<string, CoverageItem>} */
  const out = new Map();
  if (paper.arxivId) {
    const q = encodeURIComponent(`arxiv.org/abs/${paper.arxivId}`);
    const byUrl = /** @type {any} */ (await net.getJson(`${API}?query=${q}&restrictSearchableAttributes=url&tags=story`));
    for (const h of byUrl?.hits ?? []) if (isArxivUrlFor(h.url, paper.arxivId)) out.set(h.objectID, toItem(h, true));
  }
  const topic = encodeURIComponent(paper.topic ?? paper.title);
  const byTopic = /** @type {any} */ (await net.getJson(`${API}?query=${topic}&tags=story&hitsPerPage=10`));
  for (const h of byTopic?.hits ?? []) {
    if (out.has(h.objectID)) continue;
    const exact = isArxivUrlFor(h.url, paper.arxivId);
    if (!exact && titleOverlap(paper.topic ?? paper.title, String(h.title ?? '')) < 0.5) continue;
    out.set(h.objectID, toItem(h, exact));
  }
  return [...out.values()].sort((a, b) => (b.points ?? 0) - (a.points ?? 0)).slice(0, 8);
}
