// @ts-check
/**
 * Call records for the AI ops console: the exact request (by layer) and reply, cut at 64 KB per side,
 * with anything that looks like a secret replaced before it is stored.
 */
import { cutBytes } from './text.mjs';

export const MAX_BYTES = 64 * 1024;
const SECRETS = [/sk-ant-[A-Za-z0-9_-]{20,}/g, /\bsk-(?:proj-)?[A-Za-z0-9]{32,}/g, /\bAIza[0-9A-Za-z_-]{35}\b/g, /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g, /\bAKIA[0-9A-Z]{16}\b/g, /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, /postgres(?:ql)?:\/\/[^:\s/]+:[^@\s]{6,}@/g];

/** @param {string} s */
export const redact = (s) => SECRETS.reduce((acc, re) => acc.replace(re, '[redacted]'), s);

/**
 * @param {Object} a
 * @param {string} a.runId
 * @param {string|null} a.storyKey
 * @param {import('./types.mjs').Lang} a.lang
 * @param {import('../../_sdk/types').ModelRequest} a.req
 * @param {import('../../_sdk/types').ModelReply | null} a.reply
 * @param {'ok'|'error'|'refused'} a.status
 * @param {string} [a.error]
 * @param {Date} a.at
 * @returns {import('../../_sdk/types').CallRecord}
 */
export function callRecord({ runId, storyKey, lang, req, reply, status, error, at }) {
  const sys = cutBytes(redact(req.system), MAX_BYTES);
  const pr = cutBytes(redact(req.prompt), MAX_BYTES - Math.min(MAX_BYTES, new TextEncoder().encode(sys.text).length));
  const rep = cutBytes(redact(reply?.text ?? error ?? ''), MAX_BYTES);
  return {
    runId, storyKey, stage: req.stage, lang, model: req.model,
    tokensIn: reply?.tokensIn ?? 0, tokensOut: reply?.tokensOut ?? 0, cachedIn: reply?.cachedIn ?? 0,
    costUsd: reply?.costUsd ?? 0, ms: reply?.ms ?? 0, status,
    request: { system: sys.text, prompt: pr.text, truncated: sys.truncated || pr.truncated },
    reply: { text: rep.text, truncated: rep.truncated },
    requestId: reply?.requestId ?? null, at: at.toISOString(),
  };
}
