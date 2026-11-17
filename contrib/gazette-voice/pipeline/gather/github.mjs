// @ts-check
/**
 * GitHub (the worker's Net adds a token for api.github.com when one is configured).
 * Stars for code repos already found (for example from Hugging Face), plus repos whose name or
 * description mentions the arXiv id.
 */
const API = 'https://api.github.com/';

/** @typedef {import('../types.mjs').Paper} Paper @typedef {import('../types.mjs').CoverageItem} CoverageItem */

/**
 * @param {Paper} paper
 * @param {import('../types.mjs').Net} net
 * @param {CoverageItem[]} known items gathered so far (code links are enriched with stars)
 * @returns {Promise<CoverageItem[]>}
 */
export async function gatherGithub(paper, net, known = []) {
  /** @type {CoverageItem[]} */
  const out = [];
  const seen = new Set();
  for (const k of known.filter((i) => i.kind === 'code' && /^https:\/\/github\.com\//.test(i.url))) {
    const [, owner, repo] = k.url.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)/) ?? [];
    if (!owner) continue;
    const d = /** @type {any} */ (await net.getJson(`${API}repos/${owner}/${repo}`));
    if (!d?.html_url) continue;
    seen.add(String(d.html_url).toLowerCase());
    out.push({ source: 'github', kind: 'code', url: d.html_url, title: d.full_name, snippet: d.description ?? undefined, stars: Number(d.stargazers_count ?? 0), publishedAt: d.created_at ?? null, exact: true, weak: false });
  }
  if (paper.arxivId) {
    const s = /** @type {any} */ (await net.getJson(`${API}search/repositories?q=${encodeURIComponent(paper.arxivId)}&per_page=5`));
    for (const r of s?.items ?? []) {
      if (seen.has(String(r.html_url).toLowerCase())) continue;
      const mentions = `${r.name} ${r.description ?? ''}`.includes(paper.arxivId);
      out.push({ source: 'github', kind: 'code', url: r.html_url, title: r.full_name, snippet: r.description ?? undefined, stars: Number(r.stargazers_count ?? 0), exact: mentions, weak: !mentions });
    }
  }
  return out;
}
