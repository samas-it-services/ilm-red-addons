// @ts-check
/** Text helpers used by checks, terms and fixes. */

/** Markdown-style inline links: [anchor](url). */
export const LINK_RE = /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g;

/** @param {string} body @returns {Array<{ anchor: string, url: string, index: number }>} */
export const linksIn = (body) => [...body.matchAll(LINK_RE)].map((m) => ({ anchor: m[1], url: m[2], index: m.index ?? 0 }));

/** The text a reader sees: link anchors kept, URLs dropped. @param {string} body */
export const plainText = (body) => body.replace(LINK_RE, '$1');

/** @param {string} s */
export const wordCount = (s) => (plainText(s).trim().match(/\S+/g) ?? []).length;

/** Lowercase word tokens for copy detection (Latin and Urdu letters, digits). @param {string} s */
export const tokens = (s) => s.toLowerCase().normalize('NFC').match(/[\p{L}\p{N}][\p{L}\p{N}'.-]*/gu)?.map((t) => t.replace(/[.'-]+$/, '')) ?? [];

/**
 * The longest run of consecutive words in `text` that also appears in any of `sources`.
 * @param {string} text @param {string[]} sources @returns {{ n: number, run: string }}
 */
export function longestCopiedRun(text, sources) {
  const t = tokens(plainText(text));
  let best = { n: 0, run: '' };
  for (const src of sources) {
    const s = tokens(src);
    if (!s.length) continue;
    // classic longest common substring over tokens, O(len(t) * len(s))
    let prev = new Array(s.length + 1).fill(0);
    for (let i = 1; i <= t.length; i++) {
      const cur = new Array(s.length + 1).fill(0);
      for (let j = 1; j <= s.length; j++) {
        if (t[i - 1] === s[j - 1]) {
          cur[j] = prev[j - 1] + 1;
          if (cur[j] > best.n) best = { n: cur[j], run: t.slice(i - cur[j], i).join(' ') };
        }
      }
      prev = cur;
    }
  }
  return best;
}

/** Urdu digits to Latin digits, so numbers can be compared across scripts. @param {string} s */
export const latinDigits = (s) => s.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));

/**
 * Standalone numbers in a text (not parts of names like Qwen3-32B or int8). Urdu digits are read too.
 * @param {string} s @returns {string[]}
 */
export function numbersIn(s) {
  const t = latinDigits(plainText(s));
  return [...t.matchAll(/(?<![\p{L}\p{N}_.-])(\d+(?:[.,]\d+)?)(?![\p{L}\d_]|[.,]\d|-[\p{L}\d])/gu)].map((m) => m[1].replace(',', '.'));
}

/** Normalise Urdu letter forms (Arabic ya, kaf, heh to Urdu). @param {string} s */
export const normUrdu = (s) => s.replace(/ي/g, 'ی').replace(/ى/g, 'ی').replace(/ك/g, 'ک').replace(/ۀ/g, 'ہ');

/** Cut text to at most n UTF-8 bytes, on a character boundary. @param {string} s @param {number} n */
export function cutBytes(s, n) {
  const buf = new TextEncoder().encode(s);
  if (buf.length <= n) return { text: s, truncated: false };
  let text = new TextDecoder().decode(buf.slice(0, n));
  text = text.replace(/�$/, '');
  return { text, truncated: true };
}

/**
 * Split prose into sentences without breaking links or decimals: a sentence ends at . ! ? (or Urdu ۔ ؟)
 * followed by whitespace or the end. Links are shielded while splitting.
 * @param {string} body @returns {string[]} sentences, each with its trailing space, joining back to `body`
 */
export function sentences(body) {
  /** @type {string[]} */
  const links = [];
  const shielded = body.replace(LINK_RE, (m) => { links.push(m); return `\u0000${links.length - 1}\u0000`; });
  const parts = shielded.match(/[^]*?(?:[.!?\u06D4\u061F](?=\s|$)\s*|$)/gu)?.filter((x) => x.length) ?? [shielded];
  return parts.map((x) => x.replace(/\u0000(\d+)\u0000/g, (_, i) => links[Number(i)]));
}

/** The em dash, built at run time so source files never contain it (house style check). */
export const EM_DASH_RE = new RegExp(`${String.fromCharCode(0x2014)}|&${'mdash'};`);
