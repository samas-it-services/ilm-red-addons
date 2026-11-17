// @ts-check
/** Small helpers shared by the gatherers. */

/** Escape a string for use inside a RegExp. @param {string} s */
export const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * True when a URL points at exactly this arXiv paper (abs or pdf, any version), not a near-miss number.
 * @param {string|undefined|null} url
 * @param {string|null} arxivId
 */
export function isArxivUrlFor(url, arxivId) {
  if (!url || !arxivId) return false;
  return new RegExp(`arxiv\\.org/(abs|pdf|html)/${reEscape(arxivId)}(v\\d+)?(\\.pdf)?([/?#]|$)`, 'i').test(url);
}

/** Lowercase words of three or more letters. @param {string} s */
export const words = (s) => (s.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? []);

/** A crude stem: the first five letters (platonic and plato, representation and representational). @param {string} w */
export const stem = (w) => w.replace(/'s$/, '').slice(0, 5);

/**
 * Share of a title's distinctive words that appear in a text (0..1).
 * @param {string} title @param {string} text
 */
export function titleOverlap(title, text) {
  const stop = new Set(['the', 'and', 'for', 'with', 'from', 'what', 'does', 'how', 'why', 'are', 'its', 'via', 'into', 'over', 'when', 'where', 'closer', 'look', 'mean']);
  const tw = [...new Set(words(title).filter((w) => !stop.has(w)).map(stem))];
  if (!tw.length) return 0;
  const tx = new Set(words(text).map(stem));
  return tw.filter((w) => tx.has(w)).length / tw.length;
}

/** @param {string} s @param {number} n */
export const clip = (s, n) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);
