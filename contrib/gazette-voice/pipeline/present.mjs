// @ts-check
/**
 * Turns a stored story record into what the API returns to the Newsroom screen (docs/API.md):
 * byline, chips with real counts, and terms with levels and explainers.
 */

/** @typedef {import('./types.mjs').KeptSource} KeptSource */

/** @param {number} n @param {string} one @param {string} many */
const count = (n, one, many) => `${fmt(n)} ${n === 1 ? one : many}`;
/** @param {number} n */
const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));

/**
 * Chips: at most four, best first: a discussion thread, Hugging Face votes, code, then news.
 * @param {KeptSource[]} sources
 * @returns {Array<{ kind: string, label: string, detail?: string, url?: string }>}
 */
export function chipsFor(sources) {
  /** @type {Array<{ rank: number, weight?: number, chip: { kind: string, label: string, detail?: string, url?: string } }>} */
  const out = [];
  for (const { item } of sources) {
    if (item.source === 'hn' && (item.comments ?? 0) > 0) out.push({ rank: 1, weight: item.comments, chip: { kind: 'discussion', label: 'Hacker News', detail: count(item.comments ?? 0, 'comment', 'comments'), url: item.url } });
    else if (item.kind === 'votes') out.push({ rank: 2, chip: { kind: 'votes', label: 'Hugging Face', detail: count(item.points ?? 0, 'upvote', 'upvotes'), url: item.url } });
    else if (item.kind === 'code' && item.stars !== undefined) out.push({ rank: 3, chip: { kind: 'code', label: 'GitHub', detail: count(item.stars, 'star', 'stars'), url: item.url } });
    else if (item.kind === 'news' && item.outlet) out.push({ rank: 4, chip: { kind: 'news', label: item.outlet, url: item.url } });
    else if (item.kind === 'citations') out.push({ rank: 5, chip: { kind: 'citations', label: 'Semantic Scholar', detail: count(item.count ?? 0, 'citation', 'citations'), url: item.url } });
  }
  const seen = new Set();
  return out.sort((a, b) => a.rank - b.rank || (b.weight ?? 0) - (a.weight ?? 0)).filter(({ chip }) => (seen.has(chip.label) ? false : (seen.add(chip.label), true))).slice(0, 4).map((x) => x.chip);
}

/**
 * @param {import('./run.mjs').StoryRecord} rec
 * @param {{ storyId: string, paperPath: string, masthead: string, update?: string|null, revision?: number, easy?: { headline: string, text: string } }} extra
 */
export function toNewsroomData(rec, extra) {
  const s = rec.story;
  return {
    story_id: extra.storyId,
    paper_id: rec.paperId,
    paper_path: extra.paperPath,
    lang: rec.lang === 'ur' ? 'ur' : 'en',
    state: rec.state,
    headline: s?.headline ?? '',
    dept: s?.dept ?? '',
    byline: rec.lang === 'ur' ? `${extra.masthead} ڈیسک کی پیشکش` : `Posted by the ${extra.masthead.replace(/^The\s+/i, '')} desk`,
    body: s?.body ?? '',
    question: s?.question ?? '',
    chips: chipsFor(rec.sources),
    terms: rec.terms,
    update: extra.update ?? null,
    revision: extra.revision ?? 1,
    easy: extra.easy,
  };
}
