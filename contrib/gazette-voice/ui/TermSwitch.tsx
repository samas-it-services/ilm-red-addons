import type { ReactNode } from 'react';
import { useStrings } from './useStrings';
import { ALL_LEVELS, type TermPrefs } from './types';

/** "Highlight terms" plus one button per level. Off means terms are plain text, not links. */
export function TermSwitch({ prefs, onChange, end }: { prefs: TermPrefs; onChange: (p: TermPrefs) => void; end?: ReactNode }) {
  const s = useStrings();
  return (
    <div role="group" aria-label={s('terms.group')} className="flex flex-wrap items-center gap-3 border-b border-border bg-muted px-4 py-2 text-sm">
      <label className="inline-flex cursor-pointer items-center gap-2 font-medium">
        <input
          type="checkbox"
          className="h-4 w-4 accent-primary"
          checked={prefs.highlight}
          onChange={(e) => onChange({ ...prefs, highlight: e.target.checked })}
        />
        {s('terms.switch')}
      </label>
      <span className="inline-flex flex-wrap gap-1.5">
        {ALL_LEVELS.map((l) => {
          const on = prefs.levels.includes(l);
          return (
            <button
              key={l}
              type="button"
              aria-pressed={on}
              disabled={!prefs.highlight}
              onClick={() => onChange({ ...prefs, levels: on ? prefs.levels.filter((x) => x !== l) : [...prefs.levels, l] })}
              className={`min-h-8 rounded-full border px-3 text-xs font-medium disabled:opacity-50 ${on ? 'border-primary text-primary' : 'border-border text-muted-foreground line-through'}`}
            >
              {s(`level.${l}` as const)}
            </button>
          );
        })}
      </span>
      {end && <span className="ms-auto">{end}</span>}
    </div>
  );
}
