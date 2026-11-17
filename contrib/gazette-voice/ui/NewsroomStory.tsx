import { useSdk } from '../../_sdk/react';
import { useStrings } from './useStrings';
import { StoryBody, pieces } from './StoryBody';
import { DiscussionChips } from './DiscussionChips';
import type { NewsroomStoryData, TermPrefs } from './types';

export interface StoryActions {
  onSuggestFix?: (story: NewsroomStoryData) => void;
  onHistory?: (story: NewsroomStoryData) => void;
}

/** One Newsroom story, or the paper's plain story when the Newsroom one is not ready. */
export function NewsroomStory({ story, clubSlug, prefs, actions = {}, lead = false }: { story: NewsroomStoryData; clubSlug: string; prefs: TermPrefs; actions?: StoryActions; lead?: boolean }) {
  const { href, member } = useSdk();
  const s = useStrings();
  const ur = story.lang === 'ur';
  const font = ur ? 'font-nastaliq leading-loose' : '';
  if (story.state === 'plain') {
    return (
      <article className="border-b border-border py-5 last:border-b-0" dir={ur ? 'rtl' : 'ltr'} lang={story.lang}>
        <h3 className={`text-lg font-semibold ${font}`}>{story.easy?.headline ?? story.headline}</h3>
        <div className="mt-2 rounded-md border border-dashed border-border bg-muted p-3">
          <p className="mb-1 text-xs text-muted-foreground"><span className="me-1 rounded bg-muted px-1.5 py-0.5 font-mono uppercase">{s('story.plain')}</span>{s('story.plainWhy')}</p>
          <p className={`max-w-prose ${font}`}>{story.easy?.text}</p>
        </div>
        <a href={href.paper(story.paper_path)} className="mt-2 inline-block text-sm text-muted-foreground underline">{s('story.readOn')}</a>
      </article>
    );
  }
  return (
    <article className="border-b border-border py-5 last:border-b-0" dir={ur ? 'rtl' : 'ltr'} lang={story.lang} aria-labelledby={`h-${story.story_id}`}>
      <h3 id={`h-${story.story_id}`} className={`${lead ? 'text-2xl' : 'text-xl'} font-semibold text-balance ${font}`}>{story.headline}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{story.byline}</p>
      <p className={`mb-3 text-sm italic text-muted-foreground ${font}`}>{story.dept}</p>
      <div className={font}>
        <StoryBody body={story.body} terms={story.terms} clubSlug={clubSlug} prefs={prefs} />
      </div>
      {story.update && (
        <p className="my-3 max-w-prose rounded-e-md border-s-4 border-primary bg-muted px-3 py-2 text-sm">
          <b className="text-primary">{s('story.update')}</b>{' '}
          {pieces(story.update, []).map((p, i) => (p.kind === 'link' ? <a key={i} href={p.url} target="_blank" rel="nofollow ugc noopener noreferrer" className="text-primary underline">{p.text}</a> : <span key={i}>{p.text}</span>))}
        </p>
      )}
      <p className={`mt-2 max-w-prose font-semibold ${font}`}>{story.question}</p>
      <DiscussionChips chips={story.chips} />
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <a href={href.paper(story.paper_path)} className="underline">{s('story.readOn')}</a>
        {member.id && actions.onSuggestFix && <button type="button" className="underline" onClick={() => actions.onSuggestFix?.(story)}>{s('story.fix')}</button>}
        {actions.onHistory && <button type="button" className="underline" onClick={() => actions.onHistory?.(story)}>{s('story.history')}</button>}
      </div>
    </article>
  );
}
