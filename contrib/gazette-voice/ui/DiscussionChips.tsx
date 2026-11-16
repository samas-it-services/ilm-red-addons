import { useStrings } from './useStrings';
import type { NewsroomChip } from './types';

/** Real counts that link out (Hacker News, Hugging Face, GitHub ...), or "No outside coverage yet". */
export function DiscussionChips({ chips }: { chips: NewsroomChip[] }) {
  const s = useStrings();
  const list = chips.length ? chips : [{ kind: 'none' as const, label: s('chips.none'), detail: s('chips.noneDetail') }];
  return (
    <ul className="my-3 flex flex-wrap gap-2 p-0" aria-label="Coverage" dir="ltr">
      {list.map((c, i) => {
        const inner = (<>{c.label}{c.detail && <span className="text-muted-foreground">{`\u00a0· ${c.detail}`}</span>}</>);
        return (
          <li key={i} className="list-none">
            {c.url
              ? <a href={c.url} target="_blank" rel="nofollow ugc noopener noreferrer" className="inline-flex min-h-8 items-center rounded-full border border-border bg-muted/40 px-3 text-xs tabular-nums text-foreground hover:border-primary">{inner}</a>
              : <span className="inline-flex min-h-8 items-center rounded-full border border-border bg-muted/40 px-3 text-xs tabular-nums">{inner}</span>}
          </li>
        );
      })}
    </ul>
  );
}
