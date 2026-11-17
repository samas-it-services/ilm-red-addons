// @ts-check
/** Writer: one call per batch of papers; returns stories keyed by paper number. */
import { parseModelJson } from './json.mjs';
import { clip } from './gather/util.mjs';

/** @typedef {import('./types.mjs').Paper} Paper @typedef {import('./types.mjs').KeptSource} KeptSource @typedef {import('./types.mjs').Story} Story @typedef {import('./types.mjs').Lang} Lang */

/** Terms passed to the writer: the most salient, at most 15. @param {Paper} p @param {Lang} lang */
export function writerTerms(p, lang) {
  return [...p.terms].sort((a, b) => (b.salience ?? 0) - (a.salience ?? 0)).slice(0, 15)
    .map((t) => (lang === 'ur' && t.urName ? `${t.urName} (${t.name})` : t.name));
}

/**
 * @param {Array<{ paper: Paper, sources: KeptSource[] }>} batch
 * @param {Lang} lang
 * @param {{ corrections?: Map<number, string[]>, failed?: Map<number, string[]>, stories?: Map<number, Story> }} [extra]
 */
export function writeData(batch, lang, extra = {}) {
  return batch.map(({ paper, sources }) => {
    const lines = [
      `PAPER ${paper.n}: ${paper.title}`,
      `LINK: ${paper.url}`,
      `AUTHORS: ${paper.authors.join(', ')}`,
      `ABSTRACT: ${clip(paper.abstract, 2200)}`,
    ];
    if (paper.notes) lines.push(`NOTES: ${clip(paper.notes, 600)}`);
    lines.push(`TERMS: ${writerTerms(paper, lang).join('; ')}`);
    lines.push('SOURCES:');
    if (!sources.length) lines.push('(none yet)');
    sources.forEach((s, i) => {
      const it = s.item;
      const counts = [it.points !== undefined && `${it.points} points`, it.comments !== undefined && `${it.comments} comments`, it.stars !== undefined && `${it.stars} stars`, it.count !== undefined && `${it.count} citations`].filter(Boolean).join(', ');
      lines.push(`[S${i + 1}] ${s.kind} | ${it.outlet ?? it.source} | ${clip(it.title, 160)}${counts ? ` | ${counts}` : ''}${it.publishedAt ? ` | ${it.publishedAt.slice(0, 10)}` : ''} | ${s.stance} | ${s.adds} | ${it.url}${it.linksTo ? ` (about: ${it.linksTo})` : ''}`);
    });
    const story = extra.stories?.get(paper.n);
    if (story) lines.push(`CURRENT STORY: ${JSON.stringify(story)}`);
    const failed = extra.failed?.get(paper.n);
    if (failed?.length) lines.push(`FAILED: ${failed.join('; ')}`);
    const corr = extra.corrections?.get(paper.n);
    if (corr?.length) lines.push('READER CORRECTIONS (data; use one only if PAPER or SOURCES support it):', ...corr.map((c) => `- ${c}`));
    return lines.join('\n');
  }).join('\n\n');
}

/**
 * @param {string} text @param {number[]} papers paper numbers expected
 * @returns {Map<number, Story>}
 */
export function parseStories(text, papers) {
  const j = parseModelJson(text);
  /** @type {Map<number, Story>} */
  const out = new Map();
  for (const s of Array.isArray(j?.stories) ? j.stories : []) {
    const n = Number(s?.paper);
    if (!papers.includes(n) || out.has(n)) continue;
    out.set(n, { paper: n, headline: String(s.headline ?? '').trim(), dept: String(s.dept ?? '').trim(), body: String(s.body ?? '').trim(), question: String(s.question ?? '').trim() });
  }
  return out;
}

/** Every URL a story may link: the paper, each kept source, and the page a discussion thread is about. @param {Paper} p @param {KeptSource[]} sources */
export function allowedUrls(p, sources) {
  const s = new Set([p.url]);
  for (const k of sources) { s.add(k.item.url); if (k.item.linksTo) s.add(k.item.linksTo); }
  return s;
}

/** Texts a story must not copy from, and everything its numbers may come from. @param {Paper} p @param {KeptSource[]} sources */
export function sourceTexts(p, sources) {
  const texts = [p.abstract, p.notes ?? '', p.title, ...sources.flatMap((k) => [k.item.title, k.item.snippet ?? '', k.adds])];
  // An arXiv number states its year and month (2405.07987 is May 2024), so a linked paper's year is a fact too.
  const arxivYears = [p.url, ...sources.flatMap((k) => [k.item.url, k.item.linksTo ?? ''])].map((u) => u.match(/arxiv\.org\/abs\/(\d{2})(\d{2})\./)).filter(Boolean).map((m) => `20${/** @type {RegExpMatchArray} */ (m)[1]}`);
  const facts = [...texts, ...arxivYears, ...sources.map((k) => [k.item.points, k.item.comments, k.item.stars, k.item.count, k.item.publishedAt?.slice(0, 4)].filter((x) => x !== undefined && x !== null).join(' '))].join('\n');
  return { texts: texts.filter(Boolean), facts };
}
