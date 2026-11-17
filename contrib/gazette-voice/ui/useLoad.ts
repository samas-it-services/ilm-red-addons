import { useCallback, useEffect, useState } from 'react';
import { useSdk } from '../../_sdk/react';

/** Loads one API path; reload() fetches it again. Errors are shown, never thrown at the reader. */
export function useLoad<T>(path: string | null) {
  const { api } = useSdk();
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: !!path });
  const load = useCallback(async () => {
    if (!path) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try { setState({ data: await api.get<T>(path), error: null, loading: false }); }
    catch (e) { setState({ data: null, error: e instanceof Error ? e.message : String(e), loading: false }); }
  }, [api, path]);
  useEffect(() => { void load(); }, [load]);
  return { ...state, reload: load };
}

/** A stable key for a spending request, so a double click never spends twice. */
export const newIdempotencyKey = () => `gv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const usd = (n: number | null | undefined) => (n == null ? '-' : `$${n < 0.01 && n > 0 ? n.toFixed(4) : n.toFixed(2)}`);
