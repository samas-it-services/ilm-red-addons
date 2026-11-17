import type { ReactNode } from 'react';
import { SdkProvider } from './react';
import type { Api, Lang, Member, UiSdk } from './types';

/** Replies for the fake API, keyed by "METHOD path". A function gets the body. */
export type ApiRoutes = Record<string, unknown | ((body: unknown) => unknown)>;

export function fakeApi(routes: ApiRoutes, log: Array<{ method: string; path: string; body?: unknown }> = []): Api {
  const hit = async (method: string, path: string, body?: unknown) => {
    log.push({ method, path, body });
    const r = routes[`${method} ${path}`];
    if (r === undefined) throw new Error(`fakeApi: no route for ${method} ${path}`);
    return (typeof r === 'function' ? (r as (b: unknown) => unknown)(body) : r) as never;
  };
  return {
    get: (path) => hit('GET', path),
    post: (path, body) => hit('POST', path, body),
    put: (path, body) => hit('PUT', path, body),
    patch: (path, body) => hit('PATCH', path, body),
  };
}

export function testSdk(over: Partial<UiSdk> & { role?: Member['role'] } = {}): UiSdk {
  const store = new Map<string, string>();
  const lang: Lang = over.lang ?? 'en';
  return {
    member: over.member ?? { id: 'member-1', displayName: 'Test Member', role: over.role ?? 'member', isSuperAdmin: false },
    lang,
    rtl: over.rtl ?? lang === 'ur',
    t: over.t ?? ((key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key)),
    api: over.api ?? fakeApi({}),
    addonEnabled: over.addonEnabled ?? (() => true),
    prefs: over.prefs ?? { get: (k) => store.get(k) ?? null, set: (k, v) => void store.set(k, v) },
    href: over.href ?? {
      term: (club, slug) => `https://ilm.red/book-clubs/${club}/terms/${slug}`,
      paper: (path) => `https://ilm.red${path}`,
    },
  };
}

export function TestSdkProvider({ sdk, children }: { sdk?: UiSdk; children: ReactNode }) {
  return <SdkProvider value={sdk ?? testSdk()}>{children}</SdkProvider>;
}
