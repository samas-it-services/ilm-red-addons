// @ts-check
/**
 * Fakes of the SDK for tests. No network, no keys, no clock surprises.
 * @typedef {import('./types').PipelineDeps} PipelineDeps
 * @typedef {import('./types').ModelRequest} ModelRequest
 * @typedef {import('./types').ModelReply} ModelReply
 * @typedef {import('./types').CallRecord} CallRecord
 */

/**
 * A model that answers from a script. `answer` gets the request and returns the reply text (or throws).
 * Every request is recorded in `calls`.
 * @param {(req: ModelRequest, n: number) => string} answer
 * @param {{ pricePerKIn?: number, pricePerKOut?: number }} [price]
 */
export function scriptedModel(answer, price = {}) {
  /** @type {ModelRequest[]} */
  const calls = [];
  const pin = price.pricePerKIn ?? 0.003;
  const pout = price.pricePerKOut ?? 0.015;
  /** @param {ModelRequest} req @returns {Promise<ModelReply>} */
  const callModel = async (req) => {
    calls.push(req);
    const text = answer(req, calls.length);
    const tokensIn = Math.ceil((req.system.length + req.prompt.length) / 4);
    const tokensOut = Math.ceil(text.length / 4);
    const cachedIn = Math.ceil(req.system.length / 4);
    const costUsd = ((tokensIn - cachedIn) * pin + cachedIn * pin * 0.1 + tokensOut * pout) / 1000;
    return { text, tokensIn, tokensOut, cachedIn, costUsd, ms: 5, requestId: `fake-${calls.length}` };
  };
  return { callModel, calls };
}

/**
 * Network that answers from a map of URL prefix to body. Unknown URLs throw like a refused host.
 * @param {Record<string, unknown>} routes
 * @param {Record<string, number>} [statuses]
 */
export function fakeNet(routes, statuses = {}) {
  /** @type {string[]} */
  const seen = [];
  /** @param {string} url */
  const find = (url) => {
    seen.push(url);
    const key = Object.keys(routes).filter((k) => url.startsWith(k)).sort((a, b) => b.length - a.length)[0];
    if (key === undefined) throw new Error(`fakeNet: no route for ${url}`);
    return routes[key];
  };
  return {
    seen,
    net: {
      /** @param {string} url */
      getJson: async (url) => find(url),
      /** @param {string} url */
      getText: async (url) => String(find(url)),
      /** @param {string} url */
      status: async (url) => statuses[url] ?? 200,
    },
  };
}

/**
 * Full deps with fakes; override any part.
 * @param {Partial<PipelineDeps>} [over]
 * @returns {PipelineDeps & { logged: CallRecord[], queued: Array<{kind: string, subjectKey: string, payload?: Record<string, unknown>}> }}
 */
export function fakeDeps(over = {}) {
  /** @type {CallRecord[]} */
  const logged = [];
  /** @type {Array<{kind: string, subjectKey: string, payload?: Record<string, unknown>}>} */
  const queued = [];
  return {
    callModel: over.callModel ?? scriptedModel(() => '{}').callModel,
    net: over.net ?? fakeNet({}).net,
    logCall: over.logCall ?? (async (rec) => { logged.push(rec); }),
    queueJob: over.queueJob ?? (async (kind, subjectKey, payload) => { queued.push({ kind, subjectKey, payload }); return { jobId: `job-${queued.length}` }; }),
    now: over.now ?? (() => new Date('2026-11-16T18:00:00Z')),
    logged,
    queued,
  };
}
