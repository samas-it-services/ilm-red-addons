// @ts-check
/**
 * The ilm.red Tailwind config defines muted, primary, foreground, accent, border and ring as plain
 * var(...) colours with no <alpha-value>, so an opacity modifier on them (bg-muted/40) produces no CSS
 * at all in the app. Only background, card, popover and the rgb status colours (destructive, success,
 * info, warning) take one. Colours stay semantic: no hex, rgb() or hsl() literals in the screens.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const UI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'ui');
/** @param {string} d @returns {string[]} */
const files = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(d, e.name)) : e.name.endsWith('.tsx') ? [path.join(d, e.name)] : []));

describe('screens use the app colour system', () => {
  it('no opacity modifier on colours the app defines without one', () => {
    const bad = files(UI).flatMap((f) => [...fs.readFileSync(f, 'utf8').matchAll(/\b(?:bg|text|border(?:-[setblrxy])?|ring|outline|divide|from|to|via|accent|fill|stroke)-(?:muted|primary|foreground|accent|border|ring)(?:-foreground)?\/\d+/g)].map((m) => `${path.basename(f)}: ${m[0]}`));
    expect(bad).toEqual([]);
  });
  it('no colour literals', () => {
    const bad = files(UI).flatMap((f) => [...fs.readFileSync(f, 'utf8').matchAll(/#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*\d|\bhsla?\(\s*\d/g)].map((m) => `${path.basename(f)}: ${m[0]}`));
    expect(bad).toEqual([]);
  });
});
