// @ts-check
/**
 * Member fixes. The API runs these before calling the database:
 * - precheck: is the fix well-formed, and does it try to give the writer orders (then it is flagged and
 *   never reaches a prompt, only a manager's eyes)
 * - canAutoApply: may a wording fix go live without a manager (at most 12 words in one place, no number,
 *   name, link or quoted text changed, and the story still passes every check)
 * - correctionsBlock: how accepted fixes reach a regeneration, as data the Skeptic checks again
 */
import { checkStory } from './checks.mjs';
import { matchTerms } from './terms.mjs';
import { allDigits, wordCount, EM_DASH_RE, normUrdu } from './text.mjs';
import { urlShapeOk } from './links.mjs';

/** @typedef {import('./types.mjs').Story} Story */
/** @typedef {{ kind: string, quote?: string|null, replacement: string, reason?: string|null }} Fix */

export const AUTO_MAX_WORDS = 12;
export const AUTO_PER_DAY = 3;

/** Text that reads like an instruction to the AI rather than a correction. */
export const ORDER_PATTERNS = [
  /\b(ignore|disregard|forget|override)\b[^.]{0,60}\b(instructions?|rules?|prompts?|above|previous|system)\b/i,
  /\b(system prompt|you are now|act as|pretend to be|jailbreak)\b/i,
  /\b(add|insert|include|put)\b[^.]{0,30}\b(a |my |this )?(link|url|website)\b/i,
  /<\/?(system|assistant|user)>|\bassistant:|\bsystem:/i,
];

/**
 * @param {Fix} fix @param {Story} story
 * @returns {{ ok: boolean, problems: string[], flagged: boolean, quoteCount: number }}
 */
export function precheck(fix, story) {
  /** @type {string[]} */ const problems = [];
  const rep = String(fix.replacement ?? '');
  if (!rep.trim() || rep.length > 500) problems.push('replacement_length');
  if ((fix.reason ?? '').length > 500 || (fix.quote ?? '').length > 500) problems.push('too_long');
  if (EM_DASH_RE.test(rep) || EM_DASH_RE.test(fix.reason ?? '')) problems.push('em_dash');
  for (const u of `${rep} ${fix.reason ?? ''}`.match(/https?:\/\/\S+/g) ?? []) if (!urlShapeOk(u.replace(/[).,]+$/, ''))) problems.push('bad_link');
  const quoteCount = fix.quote ? story.body.split(fix.quote).length - 1 : 0;
  if (fix.quote && quoteCount === 0) problems.push('quote_not_found');
  const flagged = ORDER_PATTERNS.some((re) => re.test(rep) || re.test(fix.reason ?? ''));
  return { ok: problems.length === 0, problems, flagged, quoteCount };
}

/** Words that look like names: capitalised and not the first word. @param {string} s */
const names = (s) => (s.match(/(?<=\S\s+)\p{Lu}[\p{L}\p{N}-]*/gu) ?? []).sort().join('|');
const sameNumbers = (/** @type {string} */ a, /** @type {string} */ b) => allDigits(a).sort().join('|') === allDigits(b).sort().join('|');

/**
 * @param {Fix} fix
 * @param {Story} story
 * @param {import('./checks.mjs').CheckContext} ctx    the story's check context (gathered links, sources)
 * @param {{ terms: import('./types.mjs').Term[], todayAuto: number }} more
 * @returns {{ auto: true, story: Story, terms: ReturnType<typeof matchTerms> } | { auto: false, why: string }}
 */
export function canAutoApply(fix, story, ctx, more) {
  if (fix.kind !== 'wording') return { auto: false, why: 'kind' };
  if (more.todayAuto >= AUTO_PER_DAY) return { auto: false, why: 'daily_auto_limit' };
  const pc = precheck(fix, story);
  if (!pc.ok || pc.flagged) return { auto: false, why: pc.flagged ? 'flagged' : pc.problems.join(',') };
  const q = fix.quote ?? '';
  if (!q || pc.quoteCount !== 1) return { auto: false, why: 'quote_not_unique' };
  if (Math.max(wordCount(q), wordCount(fix.replacement)) > AUTO_MAX_WORDS) return { auto: false, why: 'too_many_words' };
  if (/[[\]()]|https?:/.test(q + fix.replacement)) return { auto: false, why: 'link_changed' };
  if (!sameNumbers(q, fix.replacement)) return { auto: false, why: 'number_changed' };
  if (/["“”'‘’«»]/.test(q.replace(/(\w)'(\w)/g, '$1$2') + fix.replacement.replace(/(\w)'(\w)/g, '$1$2'))) return { auto: false, why: 'quote_changed' };
  if (names(` x ${q}`) !== names(` x ${fix.replacement}`)) return { auto: false, why: 'name_changed' };
  const next = { ...story, body: story.body.replace(q, fix.replacement) };
  const r = checkStory(next, ctx);
  if (!r.ok) return { auto: false, why: `checks:${r.fails.map((f) => f.code).join(',')}` };
  return { auto: true, story: next, terms: matchTerms(next.body, more.terms, ctx.lang) };
}

/**
 * Accepted fixes as data lines for the writer's READER CORRECTIONS block. Flagged fixes never appear.
 * @param {Array<Fix & { flagged?: boolean }>} fixes
 * @returns {string[]}
 */
export function correctionsBlock(fixes) {
  const clean = (/** @type {string} */ s) => normUrdu(s).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
  return fixes.filter((f) => !f.flagged).map((f) => `${f.kind}: ${f.quote ? `replace "${clean(f.quote)}" with ` : 'suggests '}"${clean(f.replacement)}"${f.reason ? ` (reader's reason: ${clean(f.reason)})` : ''}`);
}
