// @ts-check
/**
 * Machine checks for a Newsroom story (no model). Every story passes these before the council sees it,
 * and again after any repair, rewrite or member fix.
 */
import { linksIn, longestCopiedRun, numbersIn, plainText, wordCount, normUrdu, latinDigits, sentences as splitSentences, EM_DASH_RE } from './text.mjs';

/** @typedef {import('./types.mjs').Story} Story @typedef {import('./types.mjs').Lang} Lang */

export const LIMITS = {
  en: { headlineChars: 70, minWords: 90, maxWords: 160, questionChars: 170, deptMin: 3, deptMax: 7, copyRun: 20 },
  ur: { headlineChars: 90, minWords: 100, maxWords: 230, questionChars: 200, deptMin: 2, deptMax: 6, copyRun: 20 },
};
export const SHORT_FACTOR = 0.7;

export const HYPE = ['groundbreaking', 'revolutionary', 'revolutionise', 'revolutionize', 'game-changer', 'game changer', 'breakthrough', 'exciting', 'clever', 'mind-blowing', 'paradigm shift'];
export const OPENERS = /^\s*(this (paper|study|work|article)\b|in this (paper|work|study)\b|we\s)/i;
export const URDU_COINAGES = ['الجھاؤ', 'ضد مادہ', 'ضد ذرہ', 'تعامل'];
const ADVICE_EN = /\b(you should (buy|sell|invest)|buy (the|this) stock|sell (the|this) stock|guaranteed return|will (rise|fall) to \$?\d)/i;
const EM_DASH = EM_DASH_RE;

/**
 * @typedef {Object} CheckContext
 * @property {Lang} lang
 * @property {Set<string>} allowedUrls  the paper URL and every gathered, kept URL
 * @property {string} paperUrl
 * @property {string[]} sourceTexts     texts the story must not copy from (abstract, notes, snippets, titles)
 * @property {string} factText          everything numbers may come from (same texts plus counts and dates)
 * @property {boolean} [finance]
 * @property {'short'|'standard'} [length]
 *
 * @typedef {{ field: 'headline'|'dept'|'body'|'question', code: string, detail?: string }} Fail
 * @typedef {{ ok: boolean, fails: Fail[], stats: { words: number, longestRun: number, links: number, headlineChars: number } }} CheckResult
 */

/** @param {Lang} lang @param {'short'|'standard'} [length] */
export function limitsFor(lang, length = 'standard') {
  const l = LIMITS[lang === 'ur' ? 'ur' : 'en'];
  if (length !== 'short') return l;
  return { ...l, minWords: Math.round(l.minWords * SHORT_FACTOR), maxWords: Math.round(l.maxWords * SHORT_FACTOR) };
}

/** @param {string} dept @param {Lang} lang @param {{deptMin: number, deptMax: number}} l */
export function deptOk(dept, lang, l) {
  if (lang === 'ur') {
    const m = normUrdu(dept.trim()).match(/^شعبۂ\s+(.+)$/u);
    if (!m) return false;
    const n = (m[1].match(/\S+/g) ?? []).length;
    return n >= l.deptMin && n <= l.deptMax;
  }
  const m = dept.trim().match(/^from the ([a-z0-9]+(?:-[a-z0-9]+)+) dept\.$/);
  if (!m) return false;
  const n = m[1].split('-').length;
  return n >= l.deptMin && n <= l.deptMax;
}

/** The data labels the prompts use, in capitals as they are written there. */
export const LABEL_LEAK = /\b(PAPER|NOTES|SOURCES|TERMS|READER CORRECTIONS)\b/;

/**
 * @param {Story} story
 * @param {CheckContext} ctx
 * @returns {CheckResult}
 */
export function checkStory(story, ctx) {
  const l = limitsFor(ctx.lang, ctx.length);
  /** @type {Fail[]} */
  const fails = [];
  const fields = /** @type {const} */ (['headline', 'dept', 'body', 'question']);
  for (const f of fields) {
    const v = String(story[f] ?? '');
    if (!v.trim()) fails.push({ field: f, code: 'empty' });
    if (EM_DASH.test(v)) fails.push({ field: f, code: 'em_dash' });
    const low = v.toLowerCase();
    for (const h of HYPE) if (low.includes(h)) fails.push({ field: f, code: 'hype', detail: h });
    if (ctx.lang === 'ur') for (const c of URDU_COINAGES) if (normUrdu(v).includes(c)) fails.push({ field: f, code: 'urdu_coinage', detail: c });
    if (ctx.lang === 'ur' && f !== 'body' && /[a-z]{4,}/i.test(v.replace(/\(.*?\)/g, ''))) fails.push({ field: f, code: 'roman_text' });
    if (ctx.finance && ADVICE_EN.test(v)) fails.push({ field: f, code: 'advice' });
    // The data labels are for the model, never for readers ("No SOURCES have weighed in yet", 16 Nov 2026).
    const leak = v.match(LABEL_LEAK);
    if (leak) fails.push({ field: f, code: 'label_leak', detail: leak[0] });
  }
  const headlineChars = [...String(story.headline ?? '')].length;
  if (headlineChars > l.headlineChars) fails.push({ field: 'headline', code: 'too_long', detail: `${headlineChars} > ${l.headlineChars}` });
  if (story.dept && !deptOk(story.dept, ctx.lang, l)) fails.push({ field: 'dept', code: 'format' });
  if ([...String(story.question ?? '')].length > l.questionChars) fails.push({ field: 'question', code: 'too_long' });

  const body = String(story.body ?? '');
  const words = wordCount(body);
  if (words > l.maxWords) fails.push({ field: 'body', code: 'too_long', detail: `${words} > ${l.maxWords}` });
  if (words < l.minWords) fails.push({ field: 'body', code: 'too_short', detail: `${words} < ${l.minWords}` });
  if (OPENERS.test(plainText(body))) fails.push({ field: 'body', code: 'opener' });
  const links = linksIn(body);
  for (const k of links) if (!ctx.allowedUrls.has(k.url)) fails.push({ field: 'body', code: 'link_not_gathered', detail: k.url });
  if (!links.some((k) => k.url === ctx.paperUrl)) fails.push({ field: 'body', code: 'no_paper_link' });
  const bareUrl = plainText(body).match(/https?:\/\/\S+/);
  if (bareUrl) fails.push({ field: 'body', code: 'bare_url', detail: bareUrl[0] });

  const run = longestCopiedRun(`${story.headline} ${body} ${story.question}`, ctx.sourceTexts);
  if (run.n > l.copyRun) fails.push({ field: 'body', code: 'copied', detail: `${run.n} words: "${run.run}"` });

  const facts = latinDigits(ctx.factText);
  for (const n of numbersIn(`${story.headline} ${body} ${story.question}`)) {
    if (!new RegExp(`(?<![\\d.])${n.replace('.', '\\.')}(?![\\d])`).test(facts)) fails.push({ field: 'body', code: 'number_not_in_sources', detail: n });
  }
  return { ok: fails.length === 0, fails, stats: { words, longestRun: run.n, links: links.length, headlineChars } };
}

/**
 * Shorten an over-long body by dropping whole sentences from the end of the longest middle stretch,
 * never the first sentence, never a sentence that holds the paper link. Returns null when it cannot.
 * @param {Story} story @param {CheckContext} ctx
 * @returns {Story|null}
 */
export function repairLength(story, ctx) {
  const l = limitsFor(ctx.lang, ctx.length);
  let sentences = splitSentences(story.body);
  if (sentences.length < 3) return null;
  const mustKeep = (/** @type {string} */ s, /** @type {number} */ i) => i === 0 || s.includes(`](${ctx.paperUrl})`);
  // Prefer dropping short asides without links first, then any non-essential sentence, from the end.
  const order = sentences.map((s, i) => ({ s, i })).filter(({ s, i }) => !mustKeep(s, i))
    .sort((a, b) => Number(a.s.includes('](')) - Number(b.s.includes('](')) || b.i - a.i);
  for (const { i } of order) {
    if (wordCount(sentences.join('')) <= l.maxWords) break;
    sentences = sentences.map((s, k) => (k === i ? '' : s));
  }
  const body = sentences.join('').replace(/\s+/g, ' ').trim();
  const w = wordCount(body);
  if (w > l.maxWords || w < l.minWords) return null;
  return { ...story, body };
}
