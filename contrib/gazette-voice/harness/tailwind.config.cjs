/** Harness only. Mirrors how the ilm.red app defines its colours (tailwind.config.js), including which
 * ones take an opacity modifier, so the screenshots show what the app will show. */
/** @param {string} v */
const mix = (v) => `color-mix(in srgb, var(--${v}) calc(<alpha-value> * 100%), transparent)`;
/** @param {string} v */
const rgb = (v) => `rgb(var(--${v}) / <alpha-value>)`;
module.exports = {
  content: [__dirname + '/out/*.html'],
  darkMode: 'class',
  theme: { extend: { colors: {
    background: mix('background'), foreground: 'var(--foreground)', card: { DEFAULT: mix('card-bg') }, popover: { DEFAULT: mix('popover'), foreground: 'var(--popover-foreground)' },
    primary: { DEFAULT: 'var(--primary)', foreground: 'var(--button-text)' }, accent: { DEFAULT: 'var(--accent)' }, border: 'var(--border)', ring: 'var(--ring)',
    muted: { DEFAULT: 'var(--muted)', foreground: 'var(--muted-foreground)' }, destructive: { DEFAULT: rgb('destructive') },
  } } },
};
