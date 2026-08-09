# Topragh data pipeline

## P0 — Canonical TK→EN

```bash
node --experimental-strip-types scripts/normalize-entries.ts
# or: bun scripts/normalize-entries.ts
```

**Sources** (copied into `data/raw/` on each run):

- `turkmen_english_dict_clean.json` — primary (better Turkmen orthography)
- `turkmen_dictionary_detailed.json` — coverage supplement

**Outputs:**

| Path | Contents |
|------|----------|
| `data/canonical/entries.en.json` | Canonical entries (`fa: null`, `fa_status: "missing"`) |
| `data/canonical/stats.json` | Counts, letters, filter tallies |

**Normalize steps:** NFC trim → drop metadata / junk defs / English-as-headword pollution (swap EN→TK using `scripts/en-words.json`) → sense split on `1. 2.` (and `I. II.`) → tags (`russian_loanword`, POS) → `letter` from first Turkmen char → slug `id`. OCR `ÿ`/`ñ` → official `ý`/`ň`. Headwords are always Turkmen.

## Later — Persian

`python scripts/translate_fa.py` reads `entries.en.json` and writes `entries.json` with `fa_status: mt_draft` (not part of P0).
