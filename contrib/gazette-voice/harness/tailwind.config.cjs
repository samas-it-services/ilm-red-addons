/** Harness only: maps the app's semantic token names to classes, as the app's own config does. */
/** @param {string} v */
const c = (v) => `hsl(var(--${v}) / <alpha-value>)`;
module.exports = {
  content: [__dirname + '/out/*.html'],
  darkMode: 'class',
  theme: { extend: { colors: { background: c('background'), foreground: c('foreground'), muted: { DEFAULT: c('muted'), foreground: c('muted-foreground') }, border: c('border'), primary: { DEFAULT: c('primary'), foreground: c('primary-foreground') }, accent: c('accent'), popover: { DEFAULT: c('popover'), foreground: c('popover-foreground') }, ring: c('ring'), destructive: c('destructive') } } },
};
