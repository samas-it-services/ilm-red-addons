// @ts-check
/**
 * The edition budget. Every call is estimated before it is made and refused when the estimate would pass
 * the cap; actual cost from the reply is added after. Rates are dollars per 1,000 tokens.
 */

/** @typedef {{ in: number, out: number, cachedIn?: number }} Rate */

/** Rough tokens for text: 4 characters per token for Latin text, 2 for Urdu script. @param {string} s */
export function roughTokens(s) {
  const urdu = (s.match(/[؀-ۿ]/g) ?? []).length;
  return Math.ceil((s.length - urdu) / 4 + urdu / 2);
}

/**
 * @param {{ system: string, prompt: string, maxTokens?: number }} req
 * @param {Rate} rate
 * @param {number} expectedOut expected output tokens
 */
export function estimateUsd(req, rate, expectedOut) {
  const sys = roughTokens(req.system);
  const pr = roughTokens(req.prompt);
  return ((sys * (rate.cachedIn ?? rate.in)) + (pr * rate.in) + (expectedOut * rate.out)) / 1000;
}

/** @param {number} capUsd @param {number} [spentUsd] */
export function createBudget(capUsd, spentUsd = 0) {
  let spent = spentUsd;
  return {
    get spent() { return spent; },
    get remaining() { return Math.max(0, capUsd - spent); },
    cap: capUsd,
    /** @param {number} estimate */
    canAfford: (estimate) => spent + estimate <= capUsd,
    /** @param {number} cost */
    add: (cost) => { spent += Math.max(0, cost); },
  };
}
