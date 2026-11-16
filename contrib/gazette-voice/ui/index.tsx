/**
 * Gazette Voice add-on: entry point (entryPoint "GazetteVoiceAddon", placement "decoration").
 * The app's Gazette shows NewsroomView as its first tab when the club has the add-on on; the manager
 * console opens from the gear (Phase 6).
 */
export { NewsroomView as default, NewsroomView, GearButton, isManager } from './NewsroomView';
export { NewsroomStory } from './NewsroomStory';
export { StoryBody, pieces } from './StoryBody';
export { TermSwitch } from './TermSwitch';
export { DiscussionChips } from './DiscussionChips';
export * from './types';
