// @ts-check
/**
 * Runs the enabled gatherers for one paper. Each source fails alone: its error becomes a note and the
 * story is written from what the others found. GitHub runs after the rest so it can add stars to code
 * links they found. Results are de-duplicated by URL.
 */
import { gatherHn } from './hn.mjs';
import { gatherHf } from './hf.mjs';
import { gatherS2 } from './s2.mjs';
import { gatherNews } from './news.mjs';
import { gatherYoutube } from './youtube.mjs';
import { gatherGithub } from './github.mjs';

/** @typedef {import('../types.mjs').Paper} Paper @typedef {import('../types.mjs').CoverageItem} CoverageItem @typedef {import('../types.mjs').Source} Source */

/** @type {Record<Exclude<Source, 'github'>, (p: Paper, n: import('../types.mjs').Net) => Promise<CoverageItem[]>>} */
const FIRST = { hn: gatherHn, hf: gatherHf, s2: gatherS2, news: gatherNews, youtube: gatherYoutube };

/**
 * @param {Paper} paper
 * @param {import('../types.mjs').Net} net
 * @param {Source[]} sources
 * @returns {Promise<{ items: CoverageItem[], notes: Array<{ source: Source, error: string }> }>}
 */
export async function gatherAll(paper, net, sources) {
  /** @type {Array<{ source: Source, error: string }>} */
  const notes = [];
  const first = /** @type {Array<Exclude<Source, 'github'>>} */ (sources.filter((s) => s !== 'github'));
  const results = await Promise.all(first.map(async (s) => {
    try { return await FIRST[s](paper, net); } catch (e) { notes.push({ source: s, error: String(/** @type {Error} */ (e).message ?? e) }); return []; }
  }));
  let items = results.flat();
  if (sources.includes('github')) {
    try {
      const gh = await gatherGithub(paper, net, items);
      const ghUrls = new Set(gh.map((g) => g.url.toLowerCase()));
      items = [...items.filter((i) => !(i.kind === 'code' && ghUrls.has(i.url.toLowerCase()))), ...gh];
    } catch (e) { notes.push({ source: 'github', error: String(/** @type {Error} */ (e).message ?? e) }); }
  }
  /** @type {Map<string, CoverageItem>} */
  const byUrl = new Map();
  for (const it of items) if (!byUrl.has(it.url)) byUrl.set(it.url, it);
  return { items: [...byUrl.values()], notes };
}
