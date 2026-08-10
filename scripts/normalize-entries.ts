#!/usr/bin/env bun
/**
 * Topragh P0: normalize TK→EN dictionary sources into canonical entries.
 *
 * Inputs (prefer data/raw/, fall back to repo root):
 *   - turkmen_english_dict_clean.json  (better orthography; primary)
 *   - english_turkmen_pdf.json (reliable inverted coverage from the companion PDF)
 *
 * Outputs:
 *   - data/canonical/entries.en.json
 *   - data/canonical/stats.json
 *
 * Run:
 *   node --experimental-strip-types scripts/normalize-entries.ts
 *   bun scripts/normalize-entries.ts
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW_DIR = join(ROOT, "data", "raw");
const CANON_DIR = join(ROOT, "data", "canonical");

const TK_SPECIAL = /[äöüýÿçşžňñÄÖÜÝŸÇŞŽŇÑ]/;
/** Strong Turkmen suffixes (avoid short ones that collide with English: -ly, -ed, …). */
const TK_SUFFIXES_STRONG = [
  "çylyk",
  "çilik",
  "mak",
  "mek",
  "lyk",
  "lik",
  "luk",
  "lük",
  "daş",
  "deş",
  "syz",
  "siz",
  "lar",
  "ler",
  "myş",
  "miş",
  "jak",
  "jek",
  "çy",
  "çi",
  "jy",
  "ji",
  "dyr",
  "dir",
  "dur",
  "dür",
];
/** Weaker suffixes — OK for headword TK cues, not for judging English glosses. */
const TK_SUFFIXES_WEAK = ["ly", "li", "lu", "lü"];
const TK_SUFFIXES = [...TK_SUFFIXES_STRONG, ...TK_SUFFIXES_WEAK];

const ENG_FUNC = new Set([
  "the",
  "of",
  "to",
  "a",
  "an",
  "in",
  "on",
  "for",
  "with",
  "and",
  "or",
  "from",
  "by",
  "as",
  "at",
  "into",
  "about",
  "one",
  "ones",
  "will",
  "own",
  "two",
  "time",
  "up",
  "down",
  "out",
  "off",
  "over",
  "under",
  "again",
  "away",
  "back",
]);

const ENG_MORPH =
  /(tion|sion|ness|ment|ing|ous|ical|ally|ence|ance|ism|ist|ity|ive|ful|less|able|ible|ary|ory|ure|age|ship|hood|ward|wise|ically|edly|ingly)$/;

/** ASCII tokens that mark an English gloss (len ≥ 2 — avoid ýa / \ba\b false positives). */
const ENG_GLOSS_WORDS = new Set([
  "the",
  "to",
  "an",
  "of",
  "and",
  "or",
  "for",
  "with",
  "from",
  "into",
  "without",
  "someone",
  "something",
  "person",
  "people",
  "that",
  "this",
  "these",
  "those",
  "who",
  "which",
  "when",
  "where",
  "what",
  "how",
  "be",
  "is",
  "are",
  "was",
  "were",
  "been",
  "being",
  "have",
  "has",
  "had",
  "not",
  "very",
  "more",
  "most",
  "than",
  "also",
  "only",
  "just",
  "like",
  "such",
  "each",
  "every",
  "other",
  "another",
  "any",
  "all",
  "both",
  "few",
  "many",
  "much",
  "some",
  "same",
]);

/** Common English headwords (from thorough_fix.py lexicon). */
const ENG_WORDS: Set<string> = loadEngWords();
// English tokens observed in merged OCR cells but absent from the compact
// lexicon. Keeping them here lets peelGluedEnglish() recover the Turkmen part.
for (const word of ["achievement", "appendix", "conquer", "cousin"]) ENG_WORDS.add(word);

// Additional source headwords verified against a general English word list.
// They are deliberately kept here (rather than relying on a network lookup)
// so normalizing the raw data is repeatable.
const EXTRA_ENGLISH_HEADWORDS = new Set(
  `abode absolutely accuracy aged anchor ant approval arena assault assess asthma
  axis badge bald bee besides birthday bitch bloody bolt booth bow boy bracelet
  bride butterfly buyer cafe cap carefully carnival carpet cart catalogue cathedral
  cats cheat cite citizens clip cloth collar colored commerce commissions
  congratulations consequently considered consistent constantly continent continue
  copper cork corrected counted counter cow crude dash dean dear decent defend
  destroyed dice digest dirty dish distant distributed disturbed doll dot dragon
  drawn dried drum educated enlarge enter envelope exhaust experienced fate fig
  find finished fluid fold forbidden forge forty fox frog garlic gently glow goods
  gossip greek grid grill guardian guitar gym handy hawk higher holy honey hunger
  hurricane ill illustrated improved insert inspired instrumental instruments jacket
  lamb legitimate lime literacy liver livestock lose mainland marvel membrane mercury
  mill mint missed nasty necklace needed neutral nickname nightmare noble nose notebook
  numbers ordered packed pal pants pat peas pencil petroleum pointer poison pond powers
  prices products prohibited promptly prophet puzzle rap rapids rat remainder respect
  ribbon ripe rob rows sacred sacrifice safely sandy satisfied scales scoop seller
  separated shame silly sip slim soap socks specify strengthen studies stupid suck
  supported surround swift theatre thesis threshold toe toilet token trace treasury
  tribute trustee twisted unsigned up utilize walnut watershed wax wit words worse worthy`
    .trim()
    .split(/\s+/),
);

function loadEngWords(): Set<string> {
  const path = join(ROOT, "scripts", "en-words.json");
  if (!existsSync(path)) return new Set();
  return new Set(JSON.parse(readFileSync(path, "utf8")) as string[]);
}

const POS_PATTERNS: Array<[RegExp, string]> = [
  [/\badj\./i, "adjective"],
  [/\badv\./i, "adverb"],
  [/\bconj\./i, "conjunction"],
  [/\bprep\./i, "preposition"],
  [/\binterj\./i, "interjection"],
  [/\bpron\./i, "pronoun"],
  [/\bnum\./i, "numeral"],
  [/\bn\./i, "noun"],
  [/\bv\./i, "verb"],
];

const SENSE_SPLIT = /(?:(?<=\s)|^)(\d+)\.\s+/;
const ROMAN_SENSE_SPLIT = /(?:(?<=\s)|^)([IVX]+)\.\s+/;

type Sense = { en: string; fa: null };
type Entry = {
  id: string;
  tk: string;
  letter: string;
  en: string;
  fa: null;
  fa_status: "missing";
  senses: Sense[];
  tags: string[];
};

type ExistingEntry = Entry & {
  fa?: string | null;
  fa_status?: "missing" | "mt_draft" | "reviewed";
  senses?: Array<{ en: string; fa?: string | null }>;
};

type DetailedRow = {
  word?: string;
  definition?: string;
  russian_loanword?: boolean;
  has_example?: boolean;
  pos?: string;
};

type EnglishTurkmenRow = {
  tk: string;
  en: string;
};

function nfc(s: string): string {
  return s.normalize("NFC").trim();
}

/** Map common OCR/encoding mistakes toward official Turkmen Latin. */
function fixTurkmenChars(s: string): string {
  return s
    .replaceAll("ÿ", "ý")
    .replaceAll("Ÿ", "Ý")
    .replaceAll("ñ", "ň")
    .replaceAll("Ñ", "Ň");
}

function normKey(s: string): string {
  return fixTurkmenChars(s.normalize("NFKC")).trim().toLowerCase();
}

/**
 * Key for an isolated headword/definition term.  Some source rows add a
 * trailing comma or `(r)` marker, while their reciprocal row does not.
 */
function reciprocalKey(s: string): string {
  return normKey(s)
    .replace(/\(r\)/gi, "")
    .replace(/[.,:;!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * ASCII Turkmen headwords which can look like English in the source data.
 * Keep these when resolving reciprocal EN↔TK records.
 */
const ASCII_TURKMEN_HEADWORDS = new Set([
  "hany",
  "kendir",
  "kim",
  "kurd",
  "nire",
  "nogsan",
  "paendeky",
  "pilmeni",
  "tahya",
  "tuyduk",
]);

function hasSpecial(s: string): boolean {
  return TK_SPECIAL.test(s);
}

function cleanTok(w: string): string {
  return w.toLowerCase().replace(/[^a-zäöüýÿçşžňñ]/g, "");
}

/**
 * The source's reverse English→Turkmen index contains regular superlatives
 * such as `yellowest → sap sary`. The compact word list has their base form,
 * so recognize `-est` inflections without treating any ASCII word as English.
 */
function englishSuperlativeStems(word: string): string[] {
  const w = cleanTok(word);
  if (!w.endsWith("est") || w.length < 5) return [];

  const stems = new Set<string>();
  // yellowest → yellow, happiest → happy
  stems.add(w.slice(0, -3));
  if (w.endsWith("iest")) stems.add(`${w.slice(0, -4)}y`);
  // reddest → red
  const bare = w.slice(0, -3);
  if (bare.length >= 2 && bare.at(-1) === bare.at(-2)) stems.add(bare.slice(0, -1));
  // whitest → white, latest → late
  stems.add(w.slice(0, -2));

  return [...stems].filter(Boolean);
}

function isEnglishToken(word: string, includeExtraHeadwords = false): boolean {
  const w = cleanTok(word);
  if (!w) return false;
  if (
    ENG_WORDS.has(w) ||
    ENG_GLOSS_WORDS.has(w) ||
    (includeExtraHeadwords && EXTRA_ENGLISH_HEADWORDS.has(w))
  ) {
    return true;
  }
  if (ENG_MORPH.test(w)) return true;
  return englishSuperlativeStems(w).some(
    (stem) => ENG_WORDS.has(stem) || (includeExtraHeadwords && EXTRA_ENGLISH_HEADWORDS.has(stem)),
  );
}

function hasTkSuffix(w: string, strongOnly = false): boolean {
  const wl = cleanTok(w);
  const list = strongOnly ? TK_SUFFIXES_STRONG : TK_SUFFIXES;
  return list.some((suf) => wl.endsWith(suf) && wl.length > suf.length + 1);
}

function isMeta(w: string): boolean {
  const wl = w.toLowerCase();
  return (
    wl.includes("peace corps") ||
    wl.startsWith("total entries") ||
    wl.includes("dictionary project")
  );
}

function isJunkDef(d: string): boolean {
  const t = d.trim();
  if (!t) return true;
  if (["?", "??", "=", "˜", ")", ":", "to", "I", "-", "a", "r."].includes(t)) return true;
  if (/^[?.\s\-—=~˜]+$/.test(t)) return true;
  // Sense-number stubs left after OCR splits ("3.", "II. 1.")
  if (/^(?:(?:\d+|[IVX]+)\.\s*)+$/i.test(t)) return true;
  if (/^(?:(?:\d+|[IVX]+)\.\s*)+[a-z]?$/i.test(t) && t.length <= 8) return true;
  return false;
}

function asciiWords(s: string): string[] {
  return s.toLowerCase().match(/[a-z]{2,}/g) ?? [];
}

function firstToken(s: string): string {
  return (s.trim().split(/\s+/)[0] ?? "").replace(/[(),.:;!?]+$/g, "");
}

/** True when a single lemma has clear Turkmen orthography/morphology. */
function isTurkmenLemma(w: string): boolean {
  const wl = cleanTok(w);
  if (!wl || wl.length < 2) return false;
  if (hasSpecial(w)) return true;
  if (hasTkSuffix(wl, true)) return true;
  if (isEnglishToken(wl) || ENG_FUNC.has(wl)) return false;
  // Weak suffix only when not an English lexicon hit (bitaraplyk via -lyk is strong)
  if (hasTkSuffix(wl, false)) return true;
  return false;
}

function anyWordTurkmen(s: string): boolean {
  if (hasSpecial(s)) return true;
  for (const raw of s.replace(/[,;]/g, " ").split(/\s+/)) {
    const w = raw.replace(/[(),.:;!?]+$/g, "");
    if (isTurkmenLemma(w)) return true;
  }
  return false;
}

/** Strip leading sense/POS markers before judging gloss language. */
function stripSensePrefix(d: string): string {
  return d
    .trim()
    .replace(/^(?:(?:\d+|[IVX]+)\.\s*)+/i, "")
    .replace(/^(?:r\.|adj\.|n\.|v\.|adv\.|prep\.|conj\.|interj\.|pron\.|num\.)\s*/i, "")
    .trim();
}

/**
 * English gloss detector.
 * Important: Latin Turkmen (bitaraplyk, golaý) must NOT count as English just for A-Za-z.
 */
function looksLikeEnglishGloss(d: string): boolean {
  const t = stripSensePrefix(d);
  if (!t) return false;
  if (/^to\s/i.test(t)) return true;

  const words = asciiWords(t);
  if (!words.length) return false;
  const engHits = words.filter((w) => isEnglishToken(w) || ENG_FUNC.has(w));

  if (hasSpecial(t)) {
    // Mixed OCR lines like "täzeliknewspaper" — need several EN hits to call it a gloss
    return engHits.length >= 2 && !hasTkSuffix(firstToken(t), true);
  }

  if (hasSpecial(firstToken(t)) || hasTkSuffix(firstToken(t), true) || isTurkmenLemma(firstToken(t))) {
    return false;
  }
  if (engHits.length >= 1) return true;
  if (words.length === 1 && ENG_MORPH.test(words[0]!) && !hasTkSuffix(words[0]!, true)) {
    return true;
  }
  // Multi-word ASCII with no TK cues ("early spring", "moderately soft")
  if (words.length >= 2 && !hasSpecial(t) && !hasTkSuffix(t, true)) return true;
  return false;
}

/** Short Latin defs that are not English lexicon → treat as Turkmen (gara, dem, mal). */
function isLikelyTkGlossToken(tok: string): boolean {
  const wl = cleanTok(peelGluedEnglish(tok));
  if (!wl || wl.length < 2) return false;
  if (isEnglishToken(wl) || ENG_FUNC.has(wl)) return false;
  if (isTurkmenLemma(wl) || hasSpecial(tok)) return true;
  // Unknown Latin glosses that are not English lexicon (kitap, kesgitleme, …).
  return wl.length >= 2 && wl.length <= 12;
}

function headLooksEnglish(w: string): boolean {
  if (hasSpecial(w)) return false;

  const tokens = w.toLowerCase().match(/[a-zA-Z']+/g) ?? [];
  if (!tokens.length) return false;

  // "at" + Turkmen is a valid Turkmen phrase (at = horse). Require strong TK cues
  // so English "at random" is not treated as Turkmen.
  if (tokens[0] === "at" && tokens.length > 1) {
    const rest = tokens.slice(1).join(" ");
    if (hasSpecial(rest) || hasTkSuffix(rest, true)) return false;
  }

  // English lexicon/morphology wins over TK-suffix collisions (popular/similar end in -lar).
  if (tokens.some((token) => isEnglishToken(token, true))) return true;
  if (tokens.length >= 2 && tokens.some((t) => ENG_FUNC.has(t))) return true;

  // Remaining ASCII with clear TK morphology → keep as Turkmen headword
  if (hasTkSuffix(w, true) || hasTkSuffix(w, false)) return false;

  // Multi-word / hyphenated Latin phrases (feel chilly, fellow traveller, business-trip)
  if (tokens.length >= 2 && tokens.every((t) => /^[a-z']+$/.test(t))) return true;
  return false;
}

/**
 * Some Turkmen emphatic adjectives are all ASCII compounds (sap sary,
 * ap-ak, gyp-gyzyl) and their English gloss is a regular superlative. Keep
 * these when the final EN↔EN-junk pass runs; otherwise that pass mistakes the
 * Turkmen compound for an English phrase and deletes the valid entry.
 */
function isAsciiTurkmenSuperlativeRecord(tk: string, en: string): boolean {
  const headTokens = tk.toLowerCase().match(/[a-zA-Z']+/g) ?? [];
  if (headTokens.length < 2 || headTokens.every(isEnglishToken)) return false;

  const glossTokens = asciiWords(stripSensePrefix(en));
  return (
    glossTokens.length === 1 &&
    isEnglishToken(glossTokens[0]!) &&
    englishSuperlativeStems(glossTokens[0]!).length > 0
  );
}

function defLooksTurkmen(d: string): boolean {
  if (anyWordTurkmen(d)) return true;
  // Russian-loan glosses in source data are Turkmen headword material
  if (/\(r\)/i.test(d)) return true;
  const body = stripSensePrefix(d);
  const parts = body
    .split(/[,;]| {2,}|(?=\d+\.)/)
    .map((s) => s.replace(/\(r\)/gi, "").replace(/[.,!?:]+$/g, "").trim())
    .filter(Boolean);
  for (const part of parts) {
    if (/^to\s/i.test(part)) continue;
    const toks = part.split(/\s+/).filter(Boolean);
    if (toks.length > 4) continue;
    if (toks.some((t) => isLikelyTkGlossToken(t))) return true;
  }
  return false;
}

/**
 * Strong EN→TK pollution (safe to drop/swap).
 * Head looks English AND definition looks Turkmen.
 */
function isStrongEnglishPollution(w: string, d: string): boolean {
  const headTokens = w.toLowerCase().match(/[a-z]+/g) ?? [];
  const definitionTokens = d.toLowerCase().match(/[a-z]+/g) ?? [];
  // When the definition is a verified English headword and the head itself
  // is not, this is the correct TK→EN direction (e.g. gus-gury → absolutely).
  if (
    !headTokens.some((token) => EXTRA_ENGLISH_HEADWORDS.has(token)) &&
    definitionTokens.some((token) => EXTRA_ENGLISH_HEADWORDS.has(token))
  ) {
    return false;
  }
  if (!headLooksEnglish(w)) return false;
  // Prefer TK evidence over EN-gloss heuristics (defs often mix "1. …" markers).
  if (defLooksTurkmen(d)) return true;
  if (headTokens.some((token) => EXTRA_ENGLISH_HEADWORDS.has(token))) return true;
  if (looksLikeEnglishGloss(d)) return false;
  // EN phrase head + short non-English Latin lemma (next time → indikile)
  if (w.includes(" ")) {
    const words = asciiWords(stripSensePrefix(d));
    if (words.length >= 1 && words.length <= 3 && !looksLikeEnglishGloss(d)) return true;
  }
  return false;
}

/**
 * The raw source also contains a large EN→TK block whose English words are
 * absent from the small curated English lexicon.  A plain-ASCII head paired
 * with a Turkmen-marked definition is sufficient evidence of a reversed row;
 * the exceptions are genuine ASCII Turkmen headwords listed above.
 */
function isReversedEnglishRow(w: string, d: string): boolean {
  const key = reciprocalKey(w);
  return (
    !hasSpecial(w) &&
    hasSpecial(d) &&
    !ASCII_TURKMEN_HEADWORDS.has(key) &&
    (headLooksEnglish(w) || /^[\x20-\x7e]+$/.test(w.trim()))
  );
}

function isEssayJunk(w: string, d: string): boolean {
  if (d.length > 500 && asciiWords(d).filter((x) => ENG_GLOSS_WORDS.has(x)).length >= 5) {
    return true;
  }
  if (/\.$/.test(w) && !hasSpecial(w) && d.length > 200) return true;
  if (/^(adjective|noun|verb|adverb|introduction|abbreviations)\.?$/i.test(w)) return true;
  return false;
}

/** Split glued OCR like "täzeliknewspaper" → "täzelik". */
function peelGluedEnglish(token: string): string {
  // Do not split a complete English word merely because it ends in another
  // word: `yellowest` used to become `yello` after stripping `west`.
  if (isEnglishToken(token)) return token;

  const lower = token.toLowerCase();
  for (const en of ENG_WORDS) {
    if (en.length < 4) continue;
    if (lower.endsWith(en) && lower.length > en.length + 2) {
      const peeled = token.slice(0, token.length - en.length);
      if (isTurkmenLemma(peeled) || isLikelyTkGlossToken(peeled)) return peeled;
    }
    if (lower.startsWith(en) && lower.length > en.length + 2) {
      const peeled = token.slice(en.length);
      if (isTurkmenLemma(peeled) || isLikelyTkGlossToken(peeled)) return peeled;
    }
  }
  return token;
}

/** Pull Turkmen lemmas out of an EN→TK definition for swap recovery. */
function extractTkLemmas(def: string): string[] {
  const parts = stripSensePrefix(def)
    .split(/[,;]| {2,}|(?=\d+\.)/)
    .map((s) =>
      s
        .replace(/^(?:(?:\d+|[IVX]+)\.\s*)+/i, "")
        .replace(/\(r\)/gi, "")
        .replace(/[.,!?:]+$/g, "")
        .trim(),
    );
  const out: string[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    if (!part || /^to\s/i.test(part)) continue;
    if (part.split(/\s+/).length > 4) continue;
    const aw = asciiWords(part);
    if (aw.some((w) => ENG_GLOSS_WORDS.has(w) || ENG_FUNC.has(w))) continue;

    const rawToks = part
      .split(/\s+/)
      .map(peelGluedEnglish)
      .filter((t) => {
        const wl = cleanTok(t);
        return wl && !isEnglishToken(wl) && !ENG_FUNC.has(wl);
      });
    if (!rawToks.length) continue;
    const candidate = rawToks.join(" ").trim();
    if (!candidate || candidate.length < 2) continue;
    if (
      !isTurkmenLemma(candidate) &&
      !rawToks.some((t) => isTurkmenLemma(t) || isLikelyTkGlossToken(t))
    ) {
      continue;
    }

    const lemma =
      rawToks.length === 1
        ? rawToks[0]!
        : rawToks.every((t) => isTurkmenLemma(t) || isLikelyTkGlossToken(t) || hasSpecial(t))
          ? candidate
          : rawToks.find((t) => isTurkmenLemma(t) || isLikelyTkGlossToken(t));
    if (!lemma) continue;
    const key = normKey(lemma);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(lemma);
  }
  return out;
}

/**
 * Recover the short Turkmen term from a verified reversed English row even
 * when the generic extractor mistakes an ASCII Turkmen word for English.
 */
function extractReversedLemmas(englishHead: string, definition: string): string[] {
  const extracted = extractTkLemmas(definition);
  if (extracted.length) return extracted;

  const headTokens = englishHead.toLowerCase().match(/[a-z]+/g) ?? [];
  if (!headTokens.some((token) => EXTRA_ENGLISH_HEADWORDS.has(token))) return extracted;

  const direct = stripSensePrefix(definition)
    .replace(/\b(?:Uzbek|Turkish|Turkmen)\b.*$/i, "")
    .replace(/\(r\)/gi, "")
    .replace(/[.,!?:;]+$/g, "")
    .trim();

  return /^[\p{L}\s-]{2,60}$/u.test(direct) ? [direct] : [];
}

function parseSenses(definition: string): string[] {
  const d = definition.trim();
  if (!d) return [];

  const numbered = splitNumbered(d, SENSE_SPLIT);
  if (numbered.length > 1) return numbered.filter((sense) => !isJunkDef(sense));

  const roman = splitNumbered(d, ROMAN_SENSE_SPLIT);
  if (roman.length > 1) return roman.filter((sense) => !isJunkDef(sense));

  return [d];
}

function splitNumbered(d: string, re: RegExp): string[] {
  const parts = d.split(re);
  if (parts.length === 1) return [d];

  const senses: string[] = [];
  const preamble = parts[0]?.trim() ?? "";
  if (preamble && !/^\d+$/.test(preamble) && !/^[IVX]+$/i.test(preamble)) {
    senses.push(preamble);
  }
  for (let i = 1; i < parts.length; i += 2) {
    const text = (parts[i + 1] ?? "").trim();
    if (text) senses.push(text);
  }
  return senses.length ? senses : [d];
}

function detectTags(
  definition: string,
  flags: { russian?: boolean; hasExample?: boolean; pos?: string },
): string[] {
  const tags: string[] = [];
  if (flags.russian || /\br\./i.test(definition)) tags.push("russian_loanword");
  if (flags.hasExample) tags.push("has_example");
  if (flags.pos) {
    tags.push(String(flags.pos).toLowerCase());
  } else {
    for (const [rx, name] of POS_PATTERNS) {
      if (rx.test(definition)) {
        tags.push(name);
        break;
      }
    }
  }
  const seen = new Set<string>();
  return tags.filter((t) => (seen.has(t) ? false : (seen.add(t), true)));
}

function letterOf(tk: string): string {
  if (!tk) return "?";
  const ch = [...tk][0]!;
  if (!/\p{L}/u.test(ch)) return "?";
  return ch.toLowerCase();
}

function slugify(tk: string): string {
  let s = fixTurkmenChars(tk.normalize("NFKC")).trim().toLowerCase();
  s = s.replace(/\s+/g, "-");
  s = s.replace(/[^\p{L}\p{N}\-]+/gu, "");
  s = s.replace(/-+/g, "-").replace(/^-|-$/g, "");
  return s || "entry";
}

function startsWithLetter(tk: string): boolean {
  const ch = [...tk][0] ?? "";
  return /\p{L}/u.test(ch);
}

function resolveSource(name: string): string | null {
  const inRaw = join(RAW_DIR, name);
  const inRoot = join(ROOT, name);
  if (existsSync(inRaw)) return inRaw;
  if (existsSync(inRoot)) return inRoot;
  return null;
}

function ensureRawCopies(): void {
  mkdirSync(RAW_DIR, { recursive: true });
  mkdirSync(CANON_DIR, { recursive: true });
  for (const name of [
    "turkmen_english_dict_clean.json",
    "turkmen_dictionary_detailed.json",
  ]) {
    const src = join(ROOT, name);
    const dest = join(RAW_DIR, name);
    if (existsSync(src)) copyFileSync(src, dest);
  }
}

function loadClean(): Array<[string, string]> {
  const path = resolveSource("turkmen_english_dict_clean.json");
  if (!path) throw new Error("Missing turkmen_english_dict_clean.json");
  const data = JSON.parse(readFileSync(path, "utf8")) as Record<string, string>;
  return Object.entries(data);
}

function loadDetailed(): DetailedRow[] {
  const path = resolveSource("turkmen_dictionary_detailed.json");
  if (!path) throw new Error("Missing turkmen_dictionary_detailed.json");
  return JSON.parse(readFileSync(path, "utf8")) as DetailedRow[];
}

function loadEnglishTurkmenPdf(): EnglishTurkmenRow[] {
  const path = resolveSource("english_turkmen_pdf.json");
  if (!path) {
    throw new Error(
      "Missing english_turkmen_pdf.json; run python scripts/extract_english_turkmen.py first",
    );
  }
  return JSON.parse(readFileSync(path, "utf8")) as EnglishTurkmenRow[];
}

/**
 * The detailed PDF extraction occasionally loses a column boundary and joins an
 * English headword directly to the next Turkmen one (for example,
 * "achievementüstünlikli").  The clean source is authoritative for those
 * Turkmen entries, so the joined detailed row must be discarded rather than
 * exposed as a malformed headword.
 */
function isGluedEnglishTurkmenHeadword(
  raw: string,
  englishHeads: ReadonlySet<string>,
  isRussianLoanword: boolean,
): boolean {
  if (isRussianLoanword) return false;

  const word = fixTurkmenChars(nfc(raw));
  const chars = [...word];
  for (let i = 1; i < chars.length; i++) {
    const left = chars.slice(0, i).join("");
    const right = chars.slice(i).join("");
    const englishPart = englishHeads.has(left.toLowerCase()) ? left : englishHeads.has(right.toLowerCase()) ? right : null;
    if (!englishPart) continue;
    if ((englishPart.match(/[a-z]/gi) ?? []).length < 4) continue;

    const turkmenPart = englishPart === left ? right : left;
    // A special Turkmen character is conclusive. For all-ASCII Turkmen words,
    // require that the remaining part does not itself look like an English head.
    if (hasSpecial(turkmenPart) || !headLooksEnglish(turkmenPart)) return true;
  }
  return false;
}

function normalize(): { entries: Entry[]; stats: Record<string, unknown> } {
  ensureRawCopies();

  const filtered = {
    metadata: 0,
    junk_def: 0,
    essay_junk: 0,
    english_headword: 0,
    english_swapped: 0,
    glued_headword: 0,
    empty: 0,
    duplicate: 0,
    non_letter_headword: 0,
  };

  type Acc = {
    tk: string;
    en: string;
    flags: { russian?: boolean; hasExample?: boolean; pos?: string };
    source: "clean" | "english_pdf" | "swap";
  };

  const byKey = new Map<string, Acc>();
  let sourceClean = 0;
  let sourceEnglishPdf = 0;
  let sourceSwap = 0;
  let sourceRows = 0;

  const put = (tk: string, en: string, source: Acc["source"], flags: Acc["flags"] = {}) => {
    if (!startsWithLetter(tk)) {
      filtered.non_letter_headword++;
      return;
    }
    const key = normKey(tk);
    if (!key) {
      filtered.empty++;
      return;
    }
    if (byKey.has(key)) {
      filtered.duplicate++;
      return;
    }
    byKey.set(key, { tk, en, flags, source });
    if (source === "clean") sourceClean++;
    else if (source === "english_pdf") sourceEnglishPdf++;
    else sourceSwap++;
  };

  const ingest = (
    tkRaw: string,
    enRaw: string,
    source: "clean" | "english_pdf",
    flags: Acc["flags"] = {},
  ) => {
    sourceRows++;
    if (!tkRaw || !enRaw) {
      filtered.empty++;
      return;
    }
    if (isMeta(tkRaw)) {
      filtered.metadata++;
      return;
    }
    if (isJunkDef(enRaw)) {
      filtered.junk_def++;
      return;
    }
    if (isEssayJunk(tkRaw, enRaw)) {
      filtered.essay_junk++;
      return;
    }

    // Normalize OCR chars before language detection so ÿ/ñ count as Turkmen.
    const tk = fixTurkmenChars(nfc(tkRaw));
    const en = fixTurkmenChars(nfc(enRaw));

    if (isStrongEnglishPollution(tk, en) || isReversedEnglishRow(tk, en)) {
      const lemmas = extractReversedLemmas(tk, en);
      if (!lemmas.length) {
        filtered.english_headword++;
        return;
      }
      for (const lem of lemmas) {
        put(fixTurkmenChars(nfc(lem)), tk, "swap");
        filtered.english_swapped++;
      }
      return;
    }

    put(tk, en, source, flags);
  };

  for (const [k, v] of loadClean()) {
    ingest(nfc(String(k)), nfc(String(v)), "clean");
  }

  // The prior Markdown-derived detailed source contained OCR column merges
  // (for example, partial English headwords exposed as Turkmen entries).
  // The companion PDF is parsed directly instead, which gives both broader
  // coverage and a reproducible source for every added entry.
  for (const row of loadEnglishTurkmenPdf()) {
    ingest(nfc(row.tk), nfc(row.en), "english_pdf");
  }

  // Final pass: catch EN→TK rows that slipped in before their TK→EN twin (or via weak heuristics).
  let englishRepaired = 0;
  for (const [key, acc] of [...byKey.entries()]) {
    if (!isStrongEnglishPollution(acc.tk, acc.en)) {
      // Drop EN↔EN junk (e.g. acquaintance → "2. to be")
      if (
        headLooksEnglish(acc.tk) &&
        looksLikeEnglishGloss(acc.en) &&
        !defLooksTurkmen(acc.en) &&
        !isAsciiTurkmenSuperlativeRecord(acc.tk, acc.en)
      ) {
        byKey.delete(key);
        filtered.english_headword++;
      }
      continue;
    }
    byKey.delete(key);
    const lemmas = extractReversedLemmas(acc.tk, acc.en);
    if (!lemmas.length) {
      filtered.english_headword++;
      continue;
    }
    for (const lem of lemmas) {
      const prev = byKey.size;
      put(fixTurkmenChars(nfc(lem)), fixTurkmenChars(acc.tk), "swap");
      if (byKey.size > prev) englishRepaired++;
      filtered.english_swapped++;
    }
  }

  // Drop reverse duplicates only when head is clearly English and points at an existing TK head.
  for (const [key, acc] of [...byKey.entries()]) {
    if (!headLooksEnglish(acc.tk) || !defLooksTurkmen(acc.en)) continue;
    const lemmas = extractReversedLemmas(acc.tk, acc.en);
    const pointsToExistingTk = lemmas.some((lem) => {
      const lk = normKey(lem);
      return lk && lk !== key && byKey.has(lk);
    });
    if (!pointsToExistingTk) continue;
    byKey.delete(key);
    filtered.english_headword++;
    englishRepaired++;
  }

  // Some reverse EN→TK rows escape the English-word list because their
  // English headword is uncommon or misspelled.  They are still unambiguous
  // when the exact reciprocal TK→EN row exists.  Remove only the ASCII
  // English side of those pairs; the reciprocal Turkmen row remains intact.
  const reciprocalHeads = new Map<string, string>();
  for (const [key, acc] of byKey) {
    const term = reciprocalKey(acc.tk);
    if (term && !reciprocalHeads.has(term)) reciprocalHeads.set(term, key);
  }

  for (const [key, acc] of [...byKey.entries()]) {
    const tkKey = reciprocalKey(acc.tk);
    const enKey = reciprocalKey(acc.en);
    if (
      !tkKey ||
      !enKey ||
      hasSpecial(acc.tk) ||
      !hasSpecial(acc.en) ||
      ASCII_TURKMEN_HEADWORDS.has(tkKey)
    ) {
      continue;
    }

    const reciprocalEntryKey = reciprocalHeads.get(enKey);
    if (!reciprocalEntryKey || reciprocalEntryKey === key) continue;
    const reciprocal = byKey.get(reciprocalEntryKey);
    if (!reciprocal || reciprocalKey(reciprocal.en) !== tkKey) continue;

    byKey.delete(key);
    filtered.english_headword++;
    englishRepaired++;
  }

  const usedIds = new Map<string, string>();
  const entries: Entry[] = [];

  for (const acc of byKey.values()) {
    const baseId = slugify(acc.tk);
    let id = baseId;
    let n = 2;
    while (usedIds.has(id) && usedIds.get(id) !== acc.tk) {
      id = `${baseId}-${n}`;
      n++;
    }
    usedIds.set(id, acc.tk);

    const senses = parseSenses(acc.en);
    // OCR can leave a numbered punctuation stub before otherwise valid
    // senses.  It is removed by parseSenses(); keep the displayed gloss in
    // sync rather than showing `1. .` on the entry page.
    const en = /^\s*1\.\s*[.]\s*/.test(acc.en)
      ? senses.map((sense, index) => `${index + 1}. ${sense}`).join(" ")
      : acc.en;
    entries.push({
      id,
      tk: acc.tk,
      letter: letterOf(acc.tk),
      en,
      fa: null,
      fa_status: "missing",
      senses: senses.map((s) => ({ en: s, fa: null })),
      tags: detectTags(acc.en, acc.flags),
    });
  }

  entries.sort((a, b) => {
    if (a.letter !== b.letter) return a.letter.localeCompare(b.letter, "tk");
    const c = a.tk.toLowerCase().localeCompare(b.tk.toLowerCase(), "tk");
    return c !== 0 ? c : a.id.localeCompare(b.id, "tk");
  });

  const letters = new Map<string, number>();
  for (const e of entries) {
    letters.set(e.letter, (letters.get(e.letter) ?? 0) + 1);
  }

  const filteredTotal =
    filtered.metadata +
    filtered.junk_def +
    filtered.essay_junk +
    filtered.english_headword +
    filtered.empty +
    filtered.duplicate +
    filtered.non_letter_headword;

  const stats = {
    total_entries: entries.length,
    source_rows: sourceRows,
    sources: {
      clean_kept: sourceClean,
      english_pdf_added: sourceEnglishPdf,
      swapped_from_en: sourceSwap,
      english_repaired_final_pass: englishRepaired,
    },
    filtered: { ...filtered },
    filtered_total: filteredTotal,
    letters_covered: letters.size,
    entries_by_letter: Object.fromEntries(
      [...letters.entries()].sort((a, b) => a[0].localeCompare(b[0], "tk")),
    ),
    fa_status: "missing",
    special_chars_note: "ÿ/ñ from OCR sources normalized to ý/ň (official Turkmen Latin)",
  };

  return { entries, stats };
}

/** Reuse Persian translations when a normalized entry did not change. */
function mergeExistingPersian(entries: Entry[]): Entry[] {
  const existingPath = join(CANON_DIR, "entries.json");
  if (!existsSync(existingPath)) return entries;

  const existing = JSON.parse(readFileSync(existingPath, "utf8")) as ExistingEntry[];
  const byId = new Map(existing.map((entry) => [entry.id, entry]));

  return entries.map((entry) => {
    const previous = byId.get(entry.id);
    if (!previous || previous.tk !== entry.tk || previous.en !== entry.en) return entry;

    const previousSenses = previous.senses ?? [];
    return {
      ...entry,
      fa: previous.fa ?? null,
      fa_status: previous.fa_status ?? (previous.fa ? "mt_draft" : "missing"),
      senses: entry.senses.map((sense, index) => ({
        en: sense.en,
        fa:
          previousSenses[index]?.en === sense.en
            ? (previousSenses[index]?.fa ?? null)
            : null,
      })),
    };
  });
}

function main(): void {
  const { entries, stats } = normalize();
  const outEntries = join(CANON_DIR, "entries.en.json");
  const outFullEntries = join(CANON_DIR, "entries.json");
  const outStats = join(CANON_DIR, "stats.json");
  const entriesWithPersian = mergeExistingPersian(entries);
  writeFileSync(outEntries, JSON.stringify(entries, null, 2) + "\n", "utf8");
  writeFileSync(outFullEntries, JSON.stringify(entriesWithPersian, null, 2) + "\n", "utf8");
  writeFileSync(outStats, JSON.stringify(stats, null, 2) + "\n", "utf8");

  const multi = entries.find((e) => e.senses.length > 1);
  const tagged = entries.find((e) => e.tags.includes("russian_loanword"));
  const samples = [entries.find((e) => e.tk === "ada") ?? entries[0], multi, tagged].filter(
    Boolean,
  );

  console.log(
    JSON.stringify(
      {
        wrote: [outEntries, outFullEntries, outStats],
        total_entries: stats.total_entries,
        filtered_total: stats.filtered_total,
        letters_covered: stats.letters_covered,
        entries_by_letter: stats.entries_by_letter,
        filtered: stats.filtered,
        sources: stats.sources,
        samples,
      },
      null,
      2,
    ),
  );

  const total = stats.total_entries as number;
  const hasPeace = entries.some((e) => /peace corps/i.test(e.tk));
  const missing = entries.filter((e) => !e.tk || !e.en);
  const hasY = entries.some((e) => e.tk.includes("ý") || e.tk.includes("ä") || e.tk.includes("ň"));
  // Count drops below the old ~14k dirty baseline after EN→TK de-pollution.
  if (total < 10000 || total > 16000 || hasPeace || missing.length || !hasY) {
    console.error(
      `GATE FAIL: count=${total} peace=${hasPeace} missing=${missing.length} special=${hasY}`,
    );
    process.exitCode = 1;
  } else {
    console.error(`GATE OK: ${total} entries`);
  }
}

main();
