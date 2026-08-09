const FOLD_MAP: Record<string, string> = {
  ä: 'a',
  ç: 'c',
  ñ: 'n',
  ö: 'o',
  ş: 's',
  ü: 'u',
  ÿ: 'y',
  ž: 'z',
};

/** Normalize for search matching while preserving display separately. */
export function foldTurkmen(input: string): string {
  const nfc = input.normalize('NFC').toLowerCase().trim();
  let out = '';
  for (const ch of nfc) {
    out += FOLD_MAP[ch] ?? ch;
  }
  return out.replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
}

export function detectQueryLang(q: string): 'fa' | 'latin' {
  return /[\u0600-\u06FF]/.test(q) ? 'fa' : 'latin';
}

export const TURKMEN_LETTERS = [
  'a',
  'ä',
  'b',
  'c',
  'ç',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'ñ',
  'o',
  'ö',
  'p',
  'q',
  'r',
  's',
  'ş',
  't',
  'u',
  'ü',
  'w',
  'y',
  'ÿ',
  'z',
  'ž',
] as const;
