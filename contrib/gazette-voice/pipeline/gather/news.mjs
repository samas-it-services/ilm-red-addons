// @ts-check
/**
 * News through the Google News RSS search (no key, not a documented API: treat any non-RSS reply,
 * such as a "Sorry..." block page, as a failure of this source only). Results are weak unless they cite the
 * arXiv id; the Scout step decides which are really about the paper.
 */
import { clip } from './util.mjs';

const RSS = 'https://news.google.com/rss/search';

/** @typedef {import('../types.mjs').Paper} Paper @typedef {import('../types.mjs').CoverageItem} CoverageItem */

/** @param {string} s */
const decode = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * @param {string} xml
 * @returns {Array<{title: string, link: string, pubDate: string|null, outlet: string|null, description: string}>}
 */
export function parseRss(xml) {
  if (!/<rss[\s>]/i.test(xml)) throw new Error('news: reply is not RSS (blocked or changed)');
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => {
    const tag = (/** @type {string} */ t) => { const m = it.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)); return m ? decode(m[1]) : null; };
    return { title: tag('title') ?? '', link: tag('link') ?? '', pubDate: tag('pubDate'), outlet: tag('source'), description: tag('description') ?? '' };
  });
}

/**
 * @param {Paper} paper
 * @param {import('../types.mjs').Net} net
 * @returns {Promise<CoverageItem[]>}
 */
export async function gatherNews(paper, net) {
  const phrase = paper.topic ?? paper.title;
  const q = paper.arxivId ? `"${paper.arxivId}" OR "${phrase}"` : `"${phrase}"`;
  const xml = await net.getText(`${RSS}?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`);
  /** @type {CoverageItem[]} */
  const out = [];
  const seenTitles = new Set();
  for (const r of parseRss(xml)) {
    if (!/^https:\/\//.test(r.link)) continue;
    const title = r.title.replace(/\s+-\s+[^-]+$/, '');
    const norm = title.toLowerCase();
    if (seenTitles.has(norm)) continue;
    seenTitles.add(norm);
    const text = `${r.title} ${r.description}`;
    // The search was for the exact id or the quoted phrase, so the engine already matched the article body;
    // titles often do not repeat the phrase (Quanta, EPFL). Everything not citing the id is weak: Scout decides.
    const exact = !!paper.arxivId && text.includes(paper.arxivId);
    out.push({ source: 'news', kind: 'news', url: r.link, title, outlet: r.outlet ?? undefined, snippet: clip(r.description, 300), publishedAt: r.pubDate ? new Date(r.pubDate).toISOString() : null, exact, weak: !exact });
  }
  return out.slice(0, 8);
}
