// @ts-check
/**
 * Link safety: https only, host not on the denylist, and the page answers (200 to 399 after redirects).
 * One status request per URL per run.
 */
export const DEFAULT_DENY_HOSTS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly'];

/**
 * @param {string} url
 * @param {string[]} [deny]
 */
export function urlShapeOk(url, deny = DEFAULT_DENY_HOSTS) {
  let u;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'https:' || u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  return !deny.some((d) => host === d || host.endsWith(`.${d}`));
}

/**
 * @template {{ url: string }} T
 * @param {T[]} items
 * @param {import('./types.mjs').Net} net
 * @param {{ deny?: string[], cache?: Map<string, number> }} [opts]
 * @returns {Promise<{ ok: T[], dropped: Array<{ url: string, why: string }> }>}
 */
export async function checkLinks(items, net, opts = {}) {
  const cache = opts.cache ?? new Map();
  /** @type {T[]} */ const ok = [];
  /** @type {Array<{ url: string, why: string }>} */ const dropped = [];
  for (const it of items) {
    if (!urlShapeOk(it.url, opts.deny)) { dropped.push({ url: it.url, why: 'shape' }); continue; }
    let st = cache.get(it.url);
    if (st === undefined) { try { st = await net.status(it.url); } catch { st = 0; } cache.set(it.url, st); }
    if (st >= 200 && st < 400) ok.push(it); else dropped.push({ url: it.url, why: `status ${st}` });
  }
  return { ok, dropped };
}
