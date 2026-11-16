// @ts-check
/**
 * Semantic Scholar (the worker's Net adds an API key when configured).
 * 1. Citation count for the paper itself.
 * 2. Prior work: the paper's own references whose titles share its topic words (for example the earlier
 *    papers it answers). Marked weak; Scout keeps the ones the abstract really argues with.
 */
import { titleOverlap, words } from './util.mjs';

const API = 'https://api.semanticscholar.org/graph/v1/paper/';

/** @typedef {import('../types.mjs').Paper} Paper @typedef {import('../types.mjs').CoverageItem} CoverageItem */

/** @param {Paper} p */
const s2Key = (p) => (p.arxivId ? `arXiv:${p.arxivId}` : p.doi ? `DOI:${p.doi}` : null);

/**
 * @param {Paper} paper
 * @param {import('../types.mjs').Net} net
 * @returns {Promise<CoverageItem[]>}
 */
export async function gatherS2(paper, net) {
  const key = s2Key(paper);
  if (!key) return [];
  /** @type {CoverageItem[]} */
  const out = [];
  const d = /** @type {any} */ (await net.getJson(`${API}${encodeURIComponent(key)}?fields=title,citationCount,influentialCitationCount,externalIds,url`));
  const n = Number(d?.citationCount ?? 0);
  if (d?.paperId && d.url && n > 0) out.push({ source: 's2', kind: 'citations', url: d.url, title: `Cited by ${n} papers on Semantic Scholar`, count: n, exact: true, weak: false });
  const refs = /** @type {any} */ (await net.getJson(`${API}${encodeURIComponent(key)}/references?fields=title,externalIds,citationCount,year,url&limit=100`));
  const topic = paper.topic ?? paper.title;
  const titleWords = new Set(words(paper.title));
  for (const r of refs?.data ?? []) {
    const c = r?.citedPaper;
    if (!c?.title) continue;
    const shared = words(c.title).filter((w) => titleWords.has(w) && w.length > 4).length;
    if (titleOverlap(topic, c.title) < 0.5 && shared < 3) continue;
    const ax = c.externalIds?.ArXiv;
    const url = ax ? `https://arxiv.org/abs/${ax}` : c.url;
    if (!url) continue;
    out.push({ source: 's2', kind: 'paper', url, title: c.title, snippet: `Cited by this paper; ${c.citationCount ?? 0} citations; ${c.year ?? ''}`.trim(), count: Number(c.citationCount ?? 0), publishedAt: c.year ? `${c.year}-01-01T00:00:00.000Z` : null, exact: false, weak: true });
  }
  return out.sort((a, b) => (b.kind === 'citations' ? 1 : 0) - (a.kind === 'citations' ? 1 : 0) || (b.count ?? 0) - (a.count ?? 0)).slice(0, 7);
}
