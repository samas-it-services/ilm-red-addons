// @ts-check
/** Reads a model's JSON answer: tolerates code fences and text around the object, nothing else. */

/** @param {string} text @returns {any} */
export function parseModelJson(text) {
  const t = String(text ?? '').replace(/^﻿/, '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('model reply has no JSON object');
  return JSON.parse(t.slice(a, b + 1));
}
