import { useSdk } from '../../_sdk/react';
import { useStrings } from './useStrings';
import { useTermPrefs } from './prefs';
import { TermSwitch } from './TermSwitch';
import { NewsroomStory, type StoryActions } from './NewsroomStory';
import type { NewsroomStoryData } from './types';

export const MANAGER_ROLES = ['owner', 'admin', 'moderator'] as const;

/** True for the club's owner, admins and moderators, and for super admins. */
export function isManager(role: string, superAdmin: boolean) {
  return superAdmin || (MANAGER_ROLES as readonly string[]).includes(role);
}

export function GearButton({ onOpen }: { onOpen: () => void }) {
  const s = useStrings();
  return (
    <button type="button" onClick={onOpen} aria-label={s('gear.label')} title={s('gear.label')} className="grid h-11 w-11 place-items-center rounded-full border border-border text-foreground hover:border-primary hover:text-primary">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
    </button>
  );
}

/**
 * The Newsroom view of a club's Gazette for one week. The app's Gazette renders this as the first tab
 * when the club has the add-on on (placement "gazette-view", added by the import).
 */
export function NewsroomView({ clubId, clubSlug, stories, actions, onOpenConsole }: { clubId: string; clubSlug: string; stories: NewsroomStoryData[]; actions?: StoryActions; onOpenConsole?: () => void }) {
  const sdk = useSdk();
  const [prefs, setPrefs] = useTermPrefs();
  if (!sdk.addonEnabled(clubId, 'gazette-voice')) return null;
  const manager = isManager(sdk.member.role, sdk.member.isSuperAdmin);
  return (
    <section aria-label="Newsroom" dir={sdk.rtl ? 'rtl' : 'ltr'}>
      <TermSwitch prefs={prefs} onChange={setPrefs} end={manager && onOpenConsole ? <GearButton onOpen={onOpenConsole} /> : undefined} />
      <div className="px-4">
        {stories.map((st, i) => <NewsroomStory key={st.story_id} story={st} clubSlug={clubSlug} prefs={prefs} actions={actions} lead={i === 0} />)}
      </div>
    </section>
  );
}
