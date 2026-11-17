/**
 * Gazette Voice add-on: entry point (entryPoint "GazetteVoiceAddon", placement "decoration").
 * The app's Gazette shows NewsroomView as its first tab when the club has the add-on on; the manager
 * console (OpsConsole) opens from the gear; members suggest fixes with FixForm and read StoryHistory.
 */
export { NewsroomView as default, NewsroomView, GearButton, isManager } from './NewsroomView';
export { NewsroomStory } from './NewsroomStory';
export { StoryBody, pieces } from './StoryBody';
export { TermSwitch } from './TermSwitch';
export { DiscussionChips } from './DiscussionChips';
export * from './types';
export { OpsConsole } from './console/OpsConsole';
export { FixForm } from './FixForm';
export { StoryHistory } from './StoryHistory';
