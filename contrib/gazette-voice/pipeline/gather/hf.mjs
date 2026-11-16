// @ts-check
/** Hugging Face Papers (no key): upvotes and comments, plus the code repo the page links. */
const API = 'https://huggingface.co/api/papers/';
const PAGE = 'https://huggingface.co/papers/';

/** @typedef {import('../types.mjs').Paper} Paper @typedef {import('../types.mjs').CoverageItem} CoverageItem */

/**
 * @param {Paper} paper
 * @param {import('../types.mjs').Net} net
 * @returns {Promise<CoverageItem[]>}
 */
export async function gatherHf(paper, net) {
  if (!paper.arxivId) return [];
  const d = /** @type {any} */ (await net.getJson(`${API}${paper.arxivId}`));
  if (!d || d.error || d.id !== paper.arxivId) return [];
  /** @type {CoverageItem[]} */
  const items = [{
    source: 'hf', kind: 'votes', url: `${PAGE}${paper.arxivId}`, title: `Hugging Face Papers: ${d.title ?? paper.title}`,
    points: Number(d.upvotes ?? 0), comments: Number(d.numComments ?? 0), publishedAt: d.publishedAt ?? null, exact: true, weak: false,
  }];
  if (typeof d.githubRepo === 'string' && /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(d.githubRepo)) {
    items.push({ source: 'hf', kind: 'code', url: d.githubRepo.replace(/\/$/, ''), title: 'Code linked from the paper page', exact: true, weak: false });
  }
  return items;
}
