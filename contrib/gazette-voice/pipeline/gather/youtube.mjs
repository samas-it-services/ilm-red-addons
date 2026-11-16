// @ts-check
/** YouTube Data API search (the worker's Net adds the API key for www.googleapis.com). */
import { titleOverlap } from './util.mjs';

const API = 'https://www.googleapis.com/youtube/v3/search';

/** @typedef {import('../types.mjs').Paper} Paper @typedef {import('../types.mjs').CoverageItem} CoverageItem */

/**
 * @param {Paper} paper
 * @param {import('../types.mjs').Net} net
 * @returns {Promise<CoverageItem[]>}
 */
export async function gatherYoutube(paper, net) {
  const phrase = paper.topic ?? paper.title;
  const d = /** @type {any} */ (await net.getJson(`${API}?part=snippet&type=video&maxResults=5&q=${encodeURIComponent(phrase)}`));
  /** @type {CoverageItem[]} */
  const out = [];
  for (const v of d?.items ?? []) {
    const id = v?.id?.videoId;
    if (!id || !/^[\w-]{6,20}$/.test(id)) continue;
    const text = `${v.snippet?.title ?? ''} ${v.snippet?.description ?? ''}`;
    const exact = !!paper.arxivId && text.includes(paper.arxivId);
    if (!exact && titleOverlap(phrase, text) < 0.5) continue;
    out.push({ source: 'youtube', kind: 'video', url: `https://www.youtube.com/watch?v=${id}`, title: v.snippet?.title ?? '', outlet: v.snippet?.channelTitle, publishedAt: v.snippet?.publishedAt ?? null, exact, weak: !exact });
  }
  return out;
}
