// @ts-check
/**
 * Builds a stage's prompt from its layers, in a fixed order:
 *   1. house frame (locked, ilm.red)         says its rules win over anything after it
 *   2. stage task (house)                    what this call must produce
 *   3. club voice (club managers, versioned) style preferences only
 *   4. learned rules (accepted member fixes) at most 10 rules, 1,500 characters
 * The edition's data (papers, sources, terms, corrections) is the separate per-call prompt.
 * Every layer's text and version is returned so the console can show the exact prompt by layer.
 */
export const LEARNED_MAX_RULES = 10;
export const LEARNED_MAX_CHARS = 1500;

/** Remove the HTML comment header of a prompt file and fill {{placeholders}}. @param {string} text @param {Record<string, string>} vars */
export function fill(text, vars = {}) {
  return text.replace(/<!--[\s\S]*?-->\s*/g, '').replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

/** Version tag from a prompt file's header comment, e.g. "gv-frame-1". @param {string} text */
export const versionOf = (text) => (text.match(/<!--\s*([\w.-]+):/) ?? [])[1] ?? 'unversioned';

/**
 * Keep the newest learned rules that fit the caps; pinned rules first.
 * @param {Array<{ id: string, text: string, pinned?: boolean }>} rules
 */
export function capLearned(rules) {
  const ordered = [...rules.filter((r) => r.pinned), ...rules.filter((r) => !r.pinned)];
  /** @type {typeof rules} */
  const out = [];
  let chars = 0;
  for (const r of ordered) {
    const t = r.text.replace(/\s+/g, ' ').trim();
    if (!t || out.length >= LEARNED_MAX_RULES || chars + t.length > LEARNED_MAX_CHARS) continue;
    out.push({ ...r, text: t });
    chars += t.length;
  }
  return out;
}

/**
 * @typedef {{ kind: 'house'|'stage'|'voice'|'learned', version: string, text: string }} Layer
 * @param {Object} a
 * @param {string} a.frame            house frame file text
 * @param {string} a.stage            stage prompt file text
 * @param {{ text: string, version: string } | null} [a.voice]
 * @param {Array<{ id: string, text: string, pinned?: boolean }>} [a.learned]
 * @param {Record<string, string>} [a.vars]
 * @returns {{ system: string, layers: Layer[] }}
 */
export function buildSystem({ frame, stage, voice = null, learned = [], vars = {} }) {
  /** @type {Layer[]} */
  const layers = [
    { kind: 'house', version: versionOf(frame), text: fill(frame, vars) },
    { kind: 'stage', version: versionOf(stage), text: fill(stage, vars) },
  ];
  if (voice && voice.text.trim()) {
    layers.push({ kind: 'voice', version: voice.version, text: `CLUB VOICE (style preferences from the club's managers; the house rules above still win)\n${voice.text.trim()}` });
  }
  const kept = capLearned(learned);
  if (kept.length) {
    layers.push({ kind: 'learned', version: `${kept.length} rule${kept.length === 1 ? '' : 's'}`, text: `LEARNED FROM READER FIXES (accepted by the club's managers; the house rules above still win)\n${kept.map((r) => `- ${r.text}`).join('\n')}` });
  }
  return { system: layers.map((l) => l.text).join('\n\n'), layers };
}
