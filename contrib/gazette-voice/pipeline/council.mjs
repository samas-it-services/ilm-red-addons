// @ts-check
/**
 * The Jedi Council for a story: two cheap seats (Skeptic for facts, Editor for voice) and an arbiter
 * only when they disagree. Seats propose exact {from, to} wording fixes; nothing else is changed.
 */
import { createHash } from 'node:crypto';
import { parseModelJson } from './json.mjs';
import { clip } from './gather/util.mjs';

/** @typedef {import('./types.mjs').Story} Story @typedef {import('./types.mjs').Paper} Paper @typedef {import('./types.mjs').KeptSource} KeptSource */
/** @typedef {{ from: string, to: string }} FixPair */
/** @typedef {{ verdict: 'pass'|'fail', fixes: FixPair[], score?: number, notes?: string, claims?: Array<{ text: string, status: string, where?: string }> }} SeatVerdict */

/** @param {Array<{ paper: Paper, sources: KeptSource[], story: Story }>} batch */
export function skepticData(batch) {
  return batch.map(({ paper, sources, story }) => [
    `PAPER ${paper.n}: ${paper.title}`,
    `P (abstract): ${clip(paper.abstract, 2200)}`,
    paper.notes ? `P (notes): ${paper.notes}` : '',
    ...sources.map((s, i) => `S${i + 1}: ${s.item.outlet ?? s.item.source} | ${s.item.title} | ${s.item.snippet ?? ''} | ${s.adds} | stance ${s.stance} | ${s.item.url}`),
    `STORY: ${JSON.stringify(story)}`,
  ].filter(Boolean).join('\n')).join('\n\n');
}

/** @param {Array<{ paper: Paper, story: Story }>} batch */
export const editorData = (batch) => batch.map(({ paper, story }) => `PAPER ${paper.n}: ${paper.title}\nSTORY: ${JSON.stringify(story)}`).join('\n\n');

/** @param {string} text @returns {Map<number, SeatVerdict>} */
export function parseVerdicts(text) {
  const j = parseModelJson(text);
  /** @type {Map<number, SeatVerdict>} */
  const out = new Map();
  for (const v of Array.isArray(j?.verdicts) ? j.verdicts : []) {
    const fixes = (Array.isArray(v?.fixes) ? v.fixes : []).filter((/** @type {any} */ f) => typeof f?.from === 'string' && typeof f?.to === 'string' && f.from.length > 0).map((/** @type {any} */ f) => ({ from: f.from, to: f.to }));
    out.set(Number(v?.paper), { verdict: v?.verdict === 'pass' ? 'pass' : 'fail', fixes, score: typeof v?.score === 'number' ? v.score : undefined, notes: typeof v?.notes === 'string' ? v.notes : undefined, claims: Array.isArray(v?.claims) ? v.claims : undefined });
  }
  return out;
}

/**
 * Apply exact wording fixes. A pair applies only when its `from` text occurs exactly once in one field.
 * @param {Story} story @param {FixPair[]} fixes
 * @returns {{ story: Story, applied: FixPair[], skipped: FixPair[] }}
 */
export function applyFixPairs(story, fixes) {
  const s = { ...story };
  /** @type {FixPair[]} */ const applied = [];
  /** @type {FixPair[]} */ const skipped = [];
  for (const f of fixes) {
    const fields = /** @type {const} */ (['headline', 'dept', 'body', 'question']).filter((k) => s[k].split(f.from).length === 2);
    if (fields.length !== 1) { skipped.push(f); continue; }
    s[fields[0]] = s[fields[0]].replace(f.from, f.to);
    applied.push(f);
  }
  return { story: s, applied, skipped };
}

/** Cache key for a council verdict: same story and same sources give the same verdict. @param {string} seat @param {Story} story @param {KeptSource[]} sources */
export function verdictKey(seat, story, sources) {
  const h = createHash('sha256');
  h.update(seat);
  h.update(JSON.stringify([story.headline, story.dept, story.body, story.question]));
  h.update(JSON.stringify(sources.map((s) => s.item.url)));
  return h.digest('hex');
}

/** Arbiter prompt: publish or plain, given both seats' notes. */
export const ARBITER_TASK = 'TASK: two reviewers disagree about each story below. Decide "publish" or "plain" (show the plain summary instead). Publish only when every factual claim is supported by PAPER or SOURCES and the voice is fair to everyone named. Return: {"decisions": [{"paper": 1, "decision": "publish", "why": "..."}]}';

/** @param {string} text @returns {Map<number, 'publish'|'plain'>} */
export function parseArbiter(text) {
  const j = parseModelJson(text);
  /** @type {Map<number, 'publish'|'plain'>} */
  const out = new Map();
  for (const d of Array.isArray(j?.decisions) ? j.decisions : []) out.set(Number(d?.paper), d?.decision === 'publish' ? 'publish' : 'plain');
  return out;
}
