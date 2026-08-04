/**
 * Club Quiz add-on — entry point.
 *
 * A 'tab' add-on: its surface is a club "Quiz" section (ClubQuiz). Questions come from the add-on's
 * config when a curator sets them, otherwise the built-in Cryptography set ships as the default.
 * Self-gated on useClubAddonEnabled, so it is inert unless the club has it enabled.
 */
export { default, ClubQuiz } from './ClubQuiz';
