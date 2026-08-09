import type { Messages } from './fa';

export const en: Messages = {
  locale: 'en',
  dir: 'ltr',
  brand: 'Topragh',
  brandLatin: 'توپراق',
  tagline: 'Turkmen ↔ Persian & English dictionary',
  nav: {
    search: 'Search',
    browse: 'Browse',
    about: 'About',
    contribute: 'Contribute',
  },
  theme: {
    toggle: 'Toggle theme',
    light: 'Light',
    dark: 'Dark',
  },
  langSwitch: {
    label: 'Language',
    fa: 'فارسی',
    en: 'English',
  },
  home: {
    title: 'Search',
    description: 'Find Turkmen meanings in Persian and English — fast, free, and clear.',
    trustLine: '14,755 headwords · free for education',
    searchPlaceholder: 'Type Turkmen, Persian, or English…',
    searchHint: 'Search runs instantly across the full dictionary.',
    loading: 'Preparing the index…',
    empty: 'No results. Try a different spelling or another word.',
    draft: 'draft',
    both: 'FA + EN',
  },
  browse: {
    title: 'Browse entries',
    description: 'Flip through Turkmen headwords letter by letter.',
    placeholder: 'Pick a letter.',
    loading: 'Loading…',
    empty: 'No entries for this letter.',
  },
  entry: {
    draftNote: 'Persian glosses are still drafts and may be revised.',
    senses: 'Senses',
    back: 'Back to search',
  },
  about: {
    title: 'About Topragh',
    description:
      'Topragh is a Turkmen–Persian–English dictionary — fast, transparent, and free for education.',
    lead: 'Topragh helps you look up Turkmen words with Persian and English glosses — without the clutter.',
    sections: [
      {
        heading: 'What is Topragh?',
        body: 'An online dictionary for search and alphabetical browse. Type Turkmen, Persian, or English and see the Turkmen headword with its glosses.',
      },
      {
        heading: 'Where the data comes from',
        body: 'The core lexicon is based on the Peace Corps Turkmen–English dictionary (1996–1999), shared for free educational use.',
      },
      {
        heading: 'About the Persian glosses',
        body: 'Persian meanings started as machine drafts. We revise them step by step, and your corrections make them better. When you see a “draft” label, it is not final yet.',
      },
      {
        heading: 'Who maintains it',
        body: 'Topragh is built and maintained by Aytronic. If you know a better gloss or spot a mistake, tell us on the contribute page.',
      },
    ],
    contributeLink: 'Go to the contribute page',
    license: 'Free for educational use. Commercial sale requires permission from the original authors.',
  },
  contribute: {
    title: 'Contribute',
    description: 'Help make Topragh more accurate with better glosses and new entries.',
    lead: 'If you know a word better, your note matters here — short, specific, and easy.',
    ways: [
      {
        title: 'Typos and spelling',
        body: 'Saw a mistake in a headword or gloss? Send the correction.',
      },
      {
        title: 'Better Persian gloss',
        body: 'Have a clearer or more natural Persian meaning than the draft? Share it.',
      },
      {
        title: 'New entry',
        body: 'Missing a word? Send the Turkmen headword, English gloss, and Persian if you can.',
      },
    ],
    cta: 'Report on GitHub',
    ctaNote: 'A short message is enough: the word, the issue, and your suggestion.',
  },
  footer: {
    developedBy: 'Built by',
    aytronic: 'Aytronic',
  },
};
