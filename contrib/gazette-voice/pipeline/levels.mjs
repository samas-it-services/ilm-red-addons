// @ts-check
/**
 * Easy, Advanced or Expert for each highlighted term.
 * 1. A curator's level (terms.level with a human entry in term_level_audit) wins: 1 easy, 2 and 3 advanced, 4 expert.
 * 2. Else a label saved earlier by this step (Gazette-only, per club).
 * 3. Else one cheap call labels all the rest at once, and the labels are saved for every later story.
 * Nothing here writes the shared terms.level.
 */
import { buildSystem } from './layers.mjs';
import { parseModelJson } from './json.mjs';
import { LEVELS } from './types.mjs';

/** @typedef {import('./types.mjs').Term} Term @typedef {import('./types.mjs').Level} Level */

/** @param {number|null|undefined} n @returns {Level|null} */
export function fromCuratorLevel(n) {
  if (n === 1) return 'easy';
  if (n === 2 || n === 3) return 'advanced';
  if (n === 4) return 'expert';
  return null;
}

/**
 * @param {Object} a
 * @param {Term[]} a.terms
 * @param {{ getTermLabels: (slugs: string[]) => Promise<Map<string, Level>>, saveTermLabels: (m: Map<string, Level>) => Promise<void> }} a.store
 * @param {{ name: string }} a.club
 * @param {{ frame: string, stages: Record<string, string> }} a.prompts
 * @param {Record<string, string>} a.vars
 * @param {(req: { system: string, prompt: string }, n: number) => Promise<string|null>} a.call
 * @returns {Promise<Map<string, Level>>}
 */
export async function labelTerms({ terms, store, prompts, vars, call }) {
  /** @type {Map<string, Term>} */
  const uniq = new Map();
  for (const t of terms) if (t && !uniq.has(t.slug)) uniq.set(t.slug, t);
  /** @type {Map<string, Level>} */
  const out = new Map();
  /** @type {Term[]} */
  const unknown = [];
  for (const t of uniq.values()) {
    const c = fromCuratorLevel(t.curatorLevel);
    if (c) out.set(t.slug, c);
    else if (t.savedLabel) out.set(t.slug, t.savedLabel);
  }
  const rest = [...uniq.values()].filter((t) => !out.has(t.slug));
  const saved = rest.length ? await store.getTermLabels(rest.map((t) => t.slug)) : new Map();
  for (const t of rest) { const s = saved.get(t.slug); if (s) out.set(t.slug, s); else unknown.push(t); }
  if (!unknown.length) return out;
  const req = { system: buildSystem({ frame: prompts.frame, stage: prompts.stages.level, vars }).system, prompt: `TERMS:\n${unknown.map((t) => `- ${t.slug}: ${t.name}${t.hook ? ` (${t.hook})` : ''}`).join('\n')}` };
  const text = await call(req, unknown.length);
  /** @type {Map<string, Level>} */
  const fresh = new Map();
  try {
    const j = text === null ? null : parseModelJson(text);
    for (const x of Array.isArray(j?.terms) ? j.terms : []) {
      if (uniq.has(x?.slug) && LEVELS.includes(x?.level) && !out.has(x.slug)) fresh.set(x.slug, x.level);
    }
  } catch { /* unlabelled terms fall back below, unsaved */ }
  if (fresh.size) await store.saveTermLabels(fresh);
  for (const [k, v] of fresh) out.set(k, v);
  return out;
}
