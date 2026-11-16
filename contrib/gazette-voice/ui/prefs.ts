import { useCallback, useState } from 'react';
import { useSdk } from '../../_sdk/react';
import { ALL_LEVELS, type Level, type TermPrefs } from './types';

const KEY = 'gazetteVoice.terms';

export function readPrefs(raw: string | null): TermPrefs {
  try {
    const j = raw ? JSON.parse(raw) : null;
    const levels = Array.isArray(j?.levels) ? (j.levels as unknown[]).filter((l): l is Level => ALL_LEVELS.includes(l as Level)) : ALL_LEVELS;
    return { highlight: j?.highlight !== false, levels };
  } catch {
    return { highlight: true, levels: ALL_LEVELS };
  }
}

/** The reader's term settings, remembered (account for members, browser for visitors; the SDK decides). */
export function useTermPrefs(): [TermPrefs, (p: TermPrefs) => void] {
  const { prefs } = useSdk();
  const [state, setState] = useState<TermPrefs>(() => readPrefs(prefs.get(KEY)));
  const set = useCallback((p: TermPrefs) => { setState(p); prefs.set(KEY, JSON.stringify(p)); }, [prefs]);
  return [state, set];
}
