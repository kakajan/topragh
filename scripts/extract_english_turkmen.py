#!/usr/bin/env python3
"""Extract reliable Turkmen headwords from the English-Turkmen source PDF.

The site is Turkmen-first, so each English headword is inverted into a
Turkmen -> English record.  The PDF has a consistent layout: a non-indented
line begins an English entry and indented lines continue its translations.
Only clearly Turkmen translations are emitted; this avoids treating the
English editorial notes in the source as headwords.

Run from the repository root:

    python scripts/extract_english_turkmen.py
"""

from __future__ import annotations

import json
import re
import unicodedata
from collections import OrderedDict
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "EnglishTurkmen_Dictionary.pdf"
OUTPUT = ROOT / "data" / "raw" / "english_turkmen_pdf.json"

POS = (
    r"(?:adj|adv|v|n|prep|conj|pos|id|interj|num|pron|anat|bot|col|fig|"
    r"geol|geom|gram|i\.e|mat|med|mil|poet|zool)\."
)
ENTRY = re.compile(rf"^(?P<en>.+?)\s+(?P<pos>{POS})\s*(?P<tk>.*)$", re.IGNORECASE)
POS_IN_GLOSS = re.compile(rf"\b{POS}\s*", re.IGNORECASE)
HEADER = re.compile(r"^\s*English\s+[–-]\s+Turkmen\s+\d+", re.IGNORECASE)
TURKMEN_SUFFIX = re.compile(
    r"(?:mak|mek|lyk|lik|luk|lük|çylyk|çilik|çy|çi|jy|ji|syz|siz|"
    r"daş|deş|dyr|dir|dur|dür)$",
    re.IGNORECASE,
)
ENGLISH_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
}


def normalize(value: str) -> str:
    return (
        unicodedata.normalize("NFC", value)
        .strip()
        .lower()
        .replace("ÿ", "ý")
        .replace("ñ", "ň")
    )


def is_turkmen_translation(value: str) -> bool:
    """Keep only a compact, clearly Turkmen translation phrase."""
    if not value or len(value) > 80 or len(value.split()) > 7:
        return False
    if not re.fullmatch(r"[\w\s-]+", value, flags=re.UNICODE):
        return False

    words = [word.casefold() for word in value.split()]
    if any(word in ENGLISH_WORDS for word in words):
        return False

    # A Turkmen-specific letter is conclusive.  For the few all-ASCII entries,
    # accept only the normal Turkmen derivational/infinitive endings.
    if any(ord(char) > 127 for char in value):
        return True
    return any(TURKMEN_SUFFIX.search(word) for word in words)


def clean_translation(value: str) -> str:
    value = re.sub(r"(\w)-\s+(\w)", r"\1\2", value)
    value = POS_IN_GLOSS.sub(";", value)
    value = re.sub(r"\([^)]*\)", "", value)
    return re.sub(r"\s+", " ", value).strip()


def clean_english_headword(value: str) -> str:
    """Discard a Turkmen usage note accidentally embedded in an EN headword."""
    value = re.sub(r"\([^)]*[äöüýşžňç][^)]*\)", "", value, flags=re.IGNORECASE).strip()
    # A few wrapped rows begin with a part-of-speech abbreviation and are not
    # dictionary headwords.  Keeping them creates a meaningless `.` sense.
    if re.fullmatch(r"(?:(?:adj|adv|v|n|prep|conj|pos|id|interj|num|pron)\.?[,]?\s*)+", value, re.I):
        return ""
    return value


def extract_entries(reader: PdfReader) -> list[tuple[str, str]]:
    """Return (English headword, complete Turkmen gloss text) pairs."""
    entries: list[tuple[str, str]] = []
    current: list[str] | None = None

    # Pages 1-9 are the introduction and phrasebook; English dictionary
    # entries begin on printed page 1, PDF page 10.
    for page in reader.pages[9:]:
        for raw in (page.extract_text() or "").splitlines():
            if not raw.strip() or HEADER.match(raw):
                continue

            # Continuation rows always have an indentation.  A wrapped gloss
            # can be unindented, but it cannot match the POS-bearing headword
            # pattern, so it safely remains a continuation.
            match = None if raw[:1].isspace() else ENTRY.match(raw.rstrip())
            if match:
                if current:
                    entries.append((current[0], " ".join(current[1:])))
                current = [match.group("en").strip(), match.group("tk").strip()]
            elif current:
                current.append(raw.strip())

    if current:
        entries.append((current[0], " ".join(current[1:])))
    return entries


def main() -> None:
    if not INPUT.exists():
        raise SystemExit(f"Missing source PDF: {INPUT}")

    by_tk: OrderedDict[str, dict[str, object]] = OrderedDict()
    for english, gloss in extract_entries(PdfReader(INPUT)):
        english = clean_english_headword(english)
        if not english:
            continue
        for piece in clean_translation(gloss).split(";"):
            turkmen = piece.strip(" .,:;-")
            if not is_turkmen_translation(turkmen):
                continue

            key = normalize(turkmen)
            record = by_tk.setdefault(key, {"tk": turkmen, "english": []})
            meanings = record["english"]
            assert isinstance(meanings, list)
            if english not in meanings:
                meanings.append(english)

    rows = []
    for record in by_tk.values():
        meanings = record["english"]
        assert isinstance(meanings, list)
        rows.append(
            {
                "tk": record["tk"],
                # The canonicalizer already splits numbered senses.
                "en": " ".join(f"{i}. {meaning}" for i, meaning in enumerate(meanings, start=1)),
            }
        )

    rows.sort(key=lambda row: (normalize(str(row["tk"])), str(row["tk"])))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT), "entries": len(rows)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
