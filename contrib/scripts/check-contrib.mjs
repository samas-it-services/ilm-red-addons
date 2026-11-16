#!/usr/bin/env node
// @ts-check
/**
 * Contrib checks that run on every pull request (and in `npm run verify`).
 *
 * 1. Secrets: no API keys, tokens or private keys anywhere under contrib/.
 * 2. Em dashes: none in any text a reader or a prompt could see (house style).
 * 3. Pipeline isolation: code under <addon>/pipeline/ never reads process.env, never calls fetch,
 *    never spawns processes, never evals. All I/O comes in through the SDK (see _sdk/types.ts).
 * 4. Manifest: every add-on has a manifest.json with the fields the import step needs, and every
 *    host its gatherers use is declared there.
 *
 * Usage: node scripts/check-contrib.mjs [root]   (root defaults to the contrib folder)
 * Exit code 1 with a list of problems when anything fails.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const SKIP_DIRS = new Set(['node_modules', '.git', 'coverage']);
const TEXT_EXT = new Set(['.mjs', '.js', '.ts', '.tsx', '.md', '.json', '.sql', '.yaml', '.yml', '.html', '.css', '.txt']);

/** Patterns that look like real credentials. Kept narrow so prose about keys does not trip them. */
export const SECRET_PATTERNS = [
  { name: 'Anthropic key', re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: 'OpenAI-style key', re: /\bsk-(?:proj-)?[A-Za-z0-9]{32,}/ },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: 'AWS access key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Slack token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  { name: 'Private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'JWT', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'Postgres URL with password', re: /postgres(?:ql)?:\/\/[^:\s/]+:[^@\s]{6,}@/ },
];

/** Things pipeline code must never do. */
export const PIPELINE_BANNED = [
  { name: 'process.env', re: /\bprocess\.env\b/ },
  { name: 'direct fetch', re: /(^|[^.\w])fetch\s*\(/ },
  { name: 'child_process', re: /child_process/ },
  { name: 'eval', re: /\beval\s*\(/ },
  { name: 'new Function', re: /\bnew\s+Function\s*\(/ },
  { name: 'dynamic import of a URL', re: /import\s*\(\s*['"]https?:/ },
];

/** Built at run time so this file does not contain the character it looks for. */
const EM_DASH = new RegExp(`${String.fromCharCode(0x2014)}|&${'mdash'};`);
const MANIFEST_FIELDS = ['slug', 'name', 'version', 'entryPoint', 'placement', 'category', 'license', 'description', 'privacy_statement', 'paths', 'network_hosts'];

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  /** @type {string[]} */
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (TEXT_EXT.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

/**
 * Run every check over one root. Exported so the tests can run it on planted fixtures.
 * @param {string} root
 * @returns {string[]} problems, empty when clean
 */
export function checkTree(root) {
  /** @type {string[]} */
  const problems = [];
  const files = walk(root);
  for (const f of files) {
    const rel = path.relative(root, f);
    if (rel.includes(`${path.sep}tests${path.sep}check-fixtures${path.sep}`)) continue;
    const text = fs.readFileSync(f, 'utf8');
    for (const s of SECRET_PATTERNS) if (s.re.test(text)) problems.push(`${rel}: looks like a secret (${s.name})`);
    if (EM_DASH.test(text) && !rel.endsWith('package-lock.json')) {
      const line = text.split('\n').findIndex((l) => EM_DASH.test(l)) + 1;
      problems.push(`${rel}:${line}: em dash (use a comma, colon, semicolon, parentheses or a full stop)`);
    }
    if (rel.split(path.sep).includes('pipeline') && /\.(mjs|js|ts)$/.test(f)) {
      const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const b of PIPELINE_BANNED) if (b.re.test(code)) problems.push(`${rel}: pipeline code must not use ${b.name}; take it from the SDK deps`);
    }
  }
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith('_') || SKIP_DIRS.has(e.name) || e.name === 'scripts') continue;
    const mf = path.join(root, e.name, 'manifest.json');
    if (!fs.existsSync(mf)) { problems.push(`${e.name}: no manifest.json`); continue; }
    let m;
    try { m = JSON.parse(fs.readFileSync(mf, 'utf8')); } catch { problems.push(`${e.name}/manifest.json: not valid JSON`); continue; }
    for (const k of MANIFEST_FIELDS) if (!(k in m)) problems.push(`${e.name}/manifest.json: missing "${k}"`);
    if (m.slug && m.slug !== e.name) problems.push(`${e.name}/manifest.json: slug "${m.slug}" does not match the folder`);
    const hosts = new Set(Array.isArray(m.network_hosts) ? m.network_hosts : []);
    const gatherDir = path.join(root, e.name, 'pipeline', 'gather');
    if (fs.existsSync(gatherDir)) {
      for (const g of fs.readdirSync(gatherDir).filter((x) => x.endsWith('.mjs'))) {
        const code = fs.readFileSync(path.join(gatherDir, g), 'utf8');
        for (const [, host] of code.matchAll(/https:\/\/([a-z0-9.-]+)\//g)) {
          if (!hosts.has(host)) problems.push(`${e.name}/pipeline/gather/${g}: host ${host} is not in manifest network_hosts`);
        }
      }
    }
  }
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const problems = checkTree(ROOT);
  if (problems.length) {
    console.error(`contrib checks: ${problems.length} problem(s)`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log('contrib checks: clean (secrets, em dashes, pipeline isolation, manifests)');
}
