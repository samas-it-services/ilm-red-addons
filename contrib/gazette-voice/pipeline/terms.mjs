// @ts-check
/**
 * Finds the first mention of each of the paper's terms in a story body, for highlighting.
 * Matches the name, its aliases and the name without a bracketed short form, in singular or plural,
 * case-insensitive, as whole words (a hyphen counts as part of a word, so "language models" is not
 * found inside "vision-language models"). Never inside a link. Longer names claim their text first.
 * Urdu stories match the term's Urdu name.
 */
import { LINK_RE } from './text.mjs';
import { reEscape } from './gather/util.mjs';

/** @typedef {import('./types.mjs').Term} Term @typedef {import('./types.mjs').Lang} Lang */

/** @param {Term} t @param {Lang} lang */
export function variants(t, lang) {
  if (lang === 'ur') {
    if (!t.urName) return [];
    // Urdu plurals and oblique forms: ماڈل, ماڈلز, ماڈلوں; نظریہ, نظریات
    const u = t.urName.trim();
    return [...new Set([u, `${u}ز`, `${u}وں`, `${u}یں`, `${u}ات`, u.replace(/ہ$/, 'ے')])].sort((a, b) => b.length - a.length);
  }
  const base = [t.name, t.name.replace(/\s*\([^)]*\)\s*$/, ''), ...(t.aliases ?? [])].map((v) => v.trim()).filter((v) => v.length >= 2);
  const out = new Set();
  for (const b of base) {
    out.add(b);
    if (/[A-Za-z]$/.test(b) && !/s$/i.test(b)) { out.add(`${b}s`); if (/(s|x|z|ch|sh)$/i.test(b)) out.add(`${b}es`); }
  }
  return [...out].sort((a, b) => b.length - a.length);
}

/**
 * @param {string} body
 * @param {Term[]} terms
 * @param {Lang} lang
 * @returns {Array<{ name: string, slug: string, start: number, end: number }>} positions in `body`, in reading order
 */
export function matchTerms(body, terms, lang) {
  /** @type {Array<[number, number]>} */
  const taken = [...body.matchAll(LINK_RE)].map((m) => [m.index ?? 0, (m.index ?? 0) + m[0].length]);
  const overlaps = (/** @type {number} */ a, /** @type {number} */ b) => taken.some(([x, y]) => a < y && b > x);
  const cands = terms.flatMap((t) => variants(t, lang).map((v) => ({ t, v }))).sort((a, b) => b.v.length - a.v.length);
  /** @type {Map<string, { name: string, slug: string, start: number, end: number }>} */
  const found = new Map();
  for (const { t, v } of cands) {
    if (found.has(t.slug)) continue;
    const re = new RegExp(`(?<![\\p{L}\\p{N}-])${reEscape(v)}(?![\\p{L}\\p{N}-])`, 'giu');
    for (const m of body.matchAll(re)) {
      const a = m.index ?? 0;
      const b = a + m[0].length;
      if (overlaps(a, b)) continue;
      const prev = found.get(t.slug);
      if (!prev || a < prev.start) found.set(t.slug, { name: m[0], slug: t.slug, start: a, end: b });
      break;
    }
    const f = found.get(t.slug);
    if (f) taken.push([f.start, f.end]);
  }
  return [...found.values()].sort((a, b) => a.start - b.start);
}
