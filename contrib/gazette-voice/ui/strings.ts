/**
 * The add-on's words in English and Urdu. On import these keys are added to the app's i18n files
 * (namespace "gazetteVoice"); other languages are filled by the translation job and held for review.
 */
export const STRINGS = {
  en: {
    'view.newsroom': 'Newsroom',
    'terms.switch': 'Highlight terms',
    'terms.group': 'Term highlights',
    'terms.levels': 'Underline:',
    'terms.tapHide': 'Tap to hide these underlines in the stories',
    'terms.tapShow': 'Tap to underline these terms in the stories',
    'level.easy': 'Easy',
    'level.advanced': 'Advanced',
    'level.expert': 'Expert',
    'term.noHook': 'No plain explainer yet.',
    'term.open': 'Opens the term page',
    'story.readOn': 'Read on ilm.red',
    'story.fix': 'Suggest a fix',
    'story.history': 'History',
    'story.update': 'Update:',
    'story.plain': 'Plain version',
    'story.plainWhy': "This paper's Newsroom story is not ready, so the plain story is shown.",
    'chips.none': 'No outside coverage yet',
    'chips.noneDetail': 'checked again on day 3 and day 10',
    'gear.label': 'Open the AI ops console',
  },
  ur: {
    'view.newsroom': 'نیوز روم',
    'terms.switch': 'اصطلاحات نمایاں کریں',
    'terms.group': 'اصطلاحات',
    'terms.levels': 'نشان زد:',
    'terms.tapHide': 'کہانیوں میں ان اصطلاحات کے نشان چھپانے کے لیے دبائیں',
    'terms.tapShow': 'کہانیوں میں ان اصطلاحات کو نشان زد کرنے کے لیے دبائیں',
    'level.easy': 'آسان',
    'level.advanced': 'اعلیٰ',
    'level.expert': 'ماہرانہ',
    'term.noHook': 'ابھی آسان وضاحت موجود نہیں۔',
    'term.open': 'اصطلاح کا صفحہ کھولیں',
    'story.readOn': 'ilm.red پر پڑھیں',
    'story.fix': 'درستی تجویز کریں',
    'story.history': 'تاریخچہ',
    'story.update': 'تازہ ترین:',
    'story.plain': 'سادہ خبر',
    'story.plainWhy': 'اس مقالے کی نیوز روم خبر ابھی تیار نہیں، اس لیے سادہ خبر دکھائی جا رہی ہے۔',
    'chips.none': 'ابھی کہیں اور ذکر نہیں',
    'chips.noneDetail': 'تیسرے اور دسویں دن دوبارہ دیکھا جائے گا',
    'gear.label': 'اے آئی آپریشنز کنسول کھولیں',
  },
} as const;

export type StringKey = keyof (typeof STRINGS)['en'];
