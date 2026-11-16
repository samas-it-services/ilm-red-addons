// @ts-check
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkTree } from '../check-contrib.mjs';

/** Build a throwaway contrib tree. Planted "secrets" are assembled at run time so this file stays clean. */
/** @param {Record<string, string>} files */
function tree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'contrib-check-'));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}

const manifest = (over = {}) => JSON.stringify({
  slug: 'demo', name: 'Demo', version: '0.1.0', entryPoint: 'Demo', placement: 'overview', category: 'general',
  license: 'Apache-2.0', description: 'd', privacy_statement: 'p', paths: {}, network_hosts: ['example.org'], ...over,
});

describe('contrib checks', () => {
  it('passes a clean add-on', () => {
    const root = tree({ 'demo/manifest.json': manifest(), 'demo/pipeline/a.mjs': 'export const x = (deps) => deps.net.getJson("u");\n' });
    expect(checkTree(root)).toEqual([]);
  });

  it('catches a planted key, an em dash, direct fetch, process.env and an undeclared host', () => {
    const key = 'sk-ant-' + 'a'.repeat(30);
    const root = tree({
      'demo/manifest.json': manifest(),
      'demo/notes.md': `key ${key}\n`,
      'demo/prompts/w.md': 'a ' + String.fromCharCode(0x2014) + ' b\n',
      'demo/pipeline/a.mjs': 'export const y = () => fetch("x");\nconst k = process.env.KEY;\n',
      'demo/pipeline/gather/g.mjs': 'export const u = "https://evil.example.com/x";\n',
    });
    const problems = checkTree(root).join('\n');
    expect(problems).toMatch(/looks like a secret \(Anthropic key\)/);
    expect(problems).toMatch(/em dash/);
    expect(problems).toMatch(/must not use direct fetch/);
    expect(problems).toMatch(/must not use process\.env/);
    expect(problems).toMatch(/evil\.example\.com is not in manifest network_hosts/);
  });

  it('ignores fetch and process.env mentioned only in comments', () => {
    const root = tree({ 'demo/manifest.json': manifest(), 'demo/pipeline/a.mjs': '// never call fetch() or read process.env here\nexport const z = 1;\n' });
    expect(checkTree(root)).toEqual([]);
  });

  it('flags a missing manifest field and a slug that does not match its folder', () => {
    const root = tree({ 'demo/manifest.json': manifest({ slug: 'other', network_hosts: undefined }) });
    const problems = checkTree(root).join('\n');
    expect(problems).toMatch(/does not match the folder/);
    expect(problems).toMatch(/missing "network_hosts"/);
  });

  it('the real contrib tree is clean', () => {
    const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
    expect(checkTree(root)).toEqual([]);
  });
});
