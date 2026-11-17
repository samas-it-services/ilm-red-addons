// @ts-check
/**
 * Reads the default prompt files. In ilm.red these become rows in ai_job_prompt_templates (house frame and
 * stage prompts) and gazette_voice_prompt_versions (club voices); the pipeline itself only ever receives
 * prompt text as data.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));

/** @returns {Record<string, string>} prompt name (file name without .md) to text */
export function loadPromptFiles() {
  /** @type {Record<string, string>} */
  const out = {};
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.md'))) out[f.slice(0, -3)] = fs.readFileSync(path.join(DIR, f), 'utf8');
  return out;
}
