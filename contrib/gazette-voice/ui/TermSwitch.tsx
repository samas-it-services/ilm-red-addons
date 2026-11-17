import type { ReactNode } from 'react';
import { useStrings } from './useStrings';
import { ALL_LEVELS, type TermPrefs } from './types';

/** Underline samples on a filled pill: the line takes the pill's text colour. */
const SAMPLE_ON: Record<string, string> = { easy: 'border-dotted border-current', advanced: 'border-dashed border-current', expert: 'border-solid border-current' };

/**
 * "Highlight terms" plus one button per level. Off means terms are plain text, not links. The "inline" variant
 * sits in a page's toolbar (the broadsheet): each level is shown as the underline it uses in the story.
 */
export function TermSwitch({ prefs, onChange, end, variant = 'bar' }: { prefs: TermPrefs; onChange: (p: TermPrefs) => void; end?: ReactNode; variant?: 'bar' | 'inline' }) {
  const s = useStrings();
  if (variant === 'inline') {
    return (
      <div role="group" aria-label={s('terms.group')} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {/* Each level is a clear on/off pill: filled when its terms are underlined, faded and struck through when not.
            Before, the buttons barely changed and readers took them for a broken reading-level switch. */}
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="font-sans text-xs">{s('terms.levels')}</span>
          {ALL_LEVELS.map((l) => {
            const on = prefs.levels.includes(l);
            const title = `${s(`level.${l}` as const)}: ${s(on ? 'terms.tapHide' : 'terms.tapShow')}`;
            return (
              <button
                key={l}
                type="button"
                aria-pressed={on}
                title={title}
                disabled={!prefs.highlight}
                onClick={() => onChange({ ...prefs, levels: on ? prefs.levels.filter((x) => x !== l) : [...prefs.levels, l] })}
                className={`inline-flex min-h-11 items-center rounded-full border px-3 font-sans text-xs font-semibold disabled:opacity-50 ${on ? 'border-foreground bg-foreground text-background' : 'border-muted-foreground text-muted-foreground line-through'}`}
              >
                <span className={`border-b-2 ${SAMPLE_ON[l]}`}>{s(`level.${l}` as const)}</span>
              </button>
            );
          })}
        </span>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2">
          <input type="checkbox" className="h-4 w-4 accent-foreground" checked={prefs.highlight} onChange={(e) => onChange({ ...prefs, highlight: e.target.checked })} />
          {s('terms.switch')}
        </label>
        {end}
      </div>
    );
  }
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
