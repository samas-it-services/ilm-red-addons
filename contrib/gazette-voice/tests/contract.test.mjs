// @ts-check
/** The OpenAPI draft and docs/API.md describe the same operations, and every one is marked planned. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { describe, expect, it } from 'vitest';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const spec = YAML.parse(fs.readFileSync(path.join(ROOT, 'openapi', 'gazette-voice.yaml'), 'utf8'));
const doc = fs.readFileSync(path.join(ROOT, 'docs', 'API.md'), 'utf8');
const ops = Object.entries(spec.paths).flatMap(([p, ms]) => Object.entries(/** @type {Record<string, any>} */ (ms)).map(([m, o]) => ({ path: p, method: m.toUpperCase(), op: o })));

describe('API contract draft', () => {
  it('every operation is planned, has a unique operationId and says who may call it', () => {
    expect(ops.length).toBeGreaterThanOrEqual(19);
    expect(ops.every((o) => o.op['x-status'] === 'planned' && typeof o.op['x-who'] === 'string')).toBe(true);
    expect(new Set(ops.map((o) => o.op.operationId)).size).toBe(ops.length);
  });
  it('every operation in the spec is in docs/API.md, and every path in the doc is in the spec', () => {
    const norm = (/** @type {string} */ p) => p.replace(/\{[^}]+\}/g, '{}');
    const docPaths = new Set([...doc.matchAll(/`(?:GET|POST|PUT|PATCH|DELETE) (\/[^`?\s]+)/g)].map((m) => norm(m[1])).filter((p) => !['/clubs/{}/gazette', '/clubs/{}/addons'].includes(p))); // existing app operations, not part of this spec
    const specPaths = new Set(ops.map((o) => norm(o.path)));
    for (const p of specPaths) expect(docPaths, `doc misses ${p}`).toContain(p);
    for (const p of docPaths) expect(specPaths, `spec misses ${p}`).toContain(p);
  });
  it('anything that spends takes an Idempotency-Key and says so', () => {
    for (const o of ops.filter((x) => x.op['x-spends'])) expect(o.op.parameters.map((/** @type {any} */ p) => p.name)).toContain('Idempotency-Key');
    expect(ops.filter((x) => x.op['x-spends']).map((x) => x.op.operationId).sort()).toEqual(['actOnGazetteFix', 'tryGazettePrompt']);
  });
  it('every $ref resolves', () => {
    const refs = [...JSON.stringify(spec).matchAll(/"\$ref":"#\/components\/(schemas|responses)\/(\w+)"/g)];
    for (const [, kind, name] of refs) expect(spec.components[kind], `${kind}/${name}`).toHaveProperty(name);
  });
});
