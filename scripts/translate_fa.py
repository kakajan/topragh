#!/usr/bin/env python3
"""Bootstrap Persian glosses — rate-limited Google MT + cache resume."""

from __future__ import annotations

import argparse
import json
import re
import time
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CANON = ROOT / "data" / "canonical"
IN_PATH = CANON / "entries.en.json"
OUT_PATH = CANON / "entries.json"
CACHE_PATH = CANON / "fa_cache.json"

GLOSS_OVERRIDES = {
    "intact": "سالم، دست‌نخورده",
    "intactness": "سالم‌بودن، تمامیت",
    "reputation": "شهرت، آبرو",
    "build a house": "خانه ساختن",
    "lean over": "خم شدن، به جلو خم شدن",
    "köpelmek": "افزایش یافتن، تکثیر شدن",
    "beýemçi, uprawleniýaýu şşyş(r), müdir": "مدیر",
    "island": "جزیره",
    "to cry, weep": "گریستن، گریه کردن",
    "well-being": "رفاه، خوشی",
    "tool": "ابزار",
    "tablecloth": "رومیزی",
    "lawyer": "وکیل",
    "weight": "وزن",
    "discussion, debate": "بحث، مناظره",
}

# OCR damage in the original bilingual source occasionally leaves a Turkmen
# gloss (or a clipped grammar example) where an English gloss should be. These
# meanings were recovered from the source dictionary rather than transliterated.
ENTRY_FALLBACKS = {
    "absurd": "پوچ، بی‌معنی",
    "kendir": "گیاه کنف",
    "käbiri, pylan, telimsome people": "برخی، بعضی",
    "känelemek": "افزایش یافتن، تکثیر شدن",
    "käýarym": "گاهی اوقات",
    "kim": "چه کسی",
    "kurd": "کرد",
    "läle kakmak": "ترانهٔ «لاله جان» خواندن",
    "maşyn ýagy=motor oil": "روغن موتور",
    "meniň": "دلم می‌خواهد بخوابم",
    "neneň": "کدام، چه",
    "neneňsi": "کدام، چه",
    "näçe": "چند، چه‌قدر",
    "näçe, näden": "چند، چه‌قدر",
    "näçelik": "به چه تعداد",
    "näçenji": "چندمین",
    "näden": "چه‌قدر",
    "nähili": "چه نوع، چگونه",
    "näme": "چه چیز",
    "nätmek": "چه کار کردن",
    "nätüýsli": "چه جور، از چه نوع",
    "nire": "کجا، چه مکانی",
    "nogsan": "نقص، کمبود",
    "olar gel-äýmegi": "ممکن است آن‌ها بیایند",
    "olar ýaz-aýmagy": "ممکن است آن‌ها بنویسند",
    "olar ýaz-mazlygy": "ممکن است آن‌ها ننویسند",
    "olaryň ýat-asy": "آن‌ها دلشان می‌خواهد بخوابند",
    "on üç": "سیزده؛ اتوبوس شمارهٔ ۱۳",
    "onuň": "او دلش می‌خواهد بخوابد",
    "öwşün": "درخشندگی، جلوه",
    "paendeky": "خربزهٔ زمستانی",
    "pilmeni": "بُرِک، پیراشکی",
    "reallyş": "واقعاً، به‌راستی",
    "saňalmak": "برطرف شدن بی‌حسی",
    "selçen": "به‌ندرت، کم",
    "sing the Läle Jana": "ترانهٔ «لاله جان» خواندن",
    "siziň": "شما دلتان می‌خواهد بخوابید",
    "suddenly (ş)": "ناگهان",
    "syçramak": "ناگهان پریدن",
    "t + ç": "صلح",
    "tahya": "کلاه ترکمنی",
    "tirke şmek": "با هم رفتن",
    "tuyduk": "نی، فلوت",
    "uprawleniýe (r), prowlenie (r)manager": "مدیر",
    "what kindş": "چه نوع، چگونه",
    "what sortş": "چه جور، چه چیز",
    "what to doş": "چه کار کردن",
    "whatş": "چه چیز",
    "which numberş": "چندمین",
    "whichş": "کدام",
    "ýedigen": "بزرگ",
    "ýeri": "خوب؛ پس",
    "ýylan deresi =snakeskin": "پوست مار",
}

ZWNJ = "\u200c"
TK_CHARS = re.compile(r"[äöüýÿçşžňñÄÖÜÝŸÇŞŽŇÑ]")


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s).strip()


def postprocess_fa(text: str) -> str:
    t = nfc(text).replace("ي", "ی").replace("ك", "ک")
    for pat, rep in [
        (r"\s+می\s+", " می‌"),
        (r"\bنمی\s+", f"نمی{ZWNJ}"),
        (r"\s+ها\b", f"{ZWNJ}ها"),
        (r"\s+های\b", f"{ZWNJ}های"),
        (r"\s+تر\b", f"{ZWNJ}تر"),
        (r"\s+ترین\b", f"{ZWNJ}ترین"),
    ]:
        t = re.sub(pat, rep, t)
    return re.sub(r"\s+", " ", t).strip().strip(" .؛;")


def clean_en_for_mt(en: str) -> str:
    t = en.strip()
    # Canonical multi-sense entries use `1.`, `2.`, … markers.  They are
    # structural metadata, not part of the source gloss, and would otherwise
    # prevent a match against the existing translation cache.
    t = re.sub(r"^(?:\d+|[IVX]+)\.\s*", "", t, flags=re.I)
    t = re.sub(r"^\s*r\.\s*", "", t)
    t = re.sub(r"\b(adj|adv|n|v|conj|prep)\.\s*", "", t, flags=re.I)
    return t.strip(" :;")


def looks_english_gloss(text: str) -> bool:
    if not text or TK_CHARS.search(text):
        return False
    # skip pure punctuation / numbers
    if not re.search(r"[A-Za-z]", text):
        return False
    return True


def load_cache() -> dict[str, str]:
    if CACHE_PATH.exists():
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    return {}


def save_cache(cache: dict[str, str]) -> None:
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")


def translate_batch_safe(texts: list[str], cache: dict[str, str]) -> None:
    from deep_translator import GoogleTranslator

    translator = GoogleTranslator(source="en", target="fa")
    # ``translate_batch`` sends one request per item. Group short glosses in a
    # single request instead; Google preserves this delimiter verbatim.
    delimiter = "\n###\n"
    max_chars = 4_000
    chunks: list[list[str]] = []
    chunk: list[str] = []
    size = 0
    for text in texts:
        addition = len(text) + (len(delimiter) if chunk else 0)
        if chunk and size + addition > max_chars:
            chunks.append(chunk)
            chunk = []
            size = 0
        chunk.append(text)
        size += addition
    if chunk:
        chunks.append(chunk)

    translated_count = 0
    for number, chunk in enumerate(chunks, start=1):
        try:
            results = translator.translate(delimiter.join(chunk)).split(delimiter)
            if len(results) != len(chunk):
                raise ValueError(f"translation separator was not preserved ({len(results)}/{len(chunk)})")
            for src, fa in zip(chunk, results):
                if fa:
                    cache[src] = postprocess_fa(fa)
            translated_count += len(chunk)
            save_cache(cache)
            print(f"cached {translated_count}/{len(texts)} total={len(cache)}", flush=True)
            time.sleep(0.4)
        except Exception as exc:
            print(f"batch fail at {number}: {exc}", flush=True)
            # Some otherwise-valid dictionary fragments are rejected by Google.
            # MyMemory is used only for the affected chunk, before resorting to
            # individual requests. It represents newlines as HTML entities.
            from deep_translator import MyMemoryTranslator

            backup = MyMemoryTranslator(source="en-US", target="fa-IR")
            backup_chunks: list[list[str]] = []
            backup_chunk: list[str] = []
            backup_size = 0
            for src in chunk:
                addition = len(src) + (len(delimiter) if backup_chunk else 0)
                if backup_chunk and backup_size + addition > 450:
                    backup_chunks.append(backup_chunk)
                    backup_chunk = []
                    backup_size = 0
                backup_chunk.append(src)
                backup_size += addition
            if backup_chunk:
                backup_chunks.append(backup_chunk)

            unresolved: list[str] = []
            for backup_chunk in backup_chunks:
                try:
                    translated = backup.translate(delimiter.join(backup_chunk)).replace("&#10;", "\n")
                    results = re.split(r"\s*###\s*", translated.strip())
                    if len(results) != len(backup_chunk):
                        raise ValueError(f"backup separator was not preserved ({len(results)}/{len(backup_chunk)})")
                    for src, fa in zip(backup_chunk, results):
                        if fa:
                            cache[src] = postprocess_fa(fa)
                except Exception as exc2:
                    print(f"  backup batch failed: {exc2}", flush=True)
                    unresolved.extend(backup_chunk)

            # Leave only genuinely untranslatable fragments absent.
            for src in unresolved:
                try:
                    fa = backup.translate(src[:450])
                    if fa:
                        cache[src] = postprocess_fa(fa)
                except Exception as exc2:
                    print(f"  skip {src[:80]!r}: {exc2}", flush=True)
                time.sleep(0.15)
            translated_count += len(chunk)
            save_cache(cache)


def resolve_fa(en: str, cache: dict[str, str]) -> str | None:
    key = clean_en_for_mt(en) or en
    if en in GLOSS_OVERRIDES:
        return GLOSS_OVERRIDES[en]
    if key in GLOSS_OVERRIDES:
        return GLOSS_OVERRIDES[key]
    if key in cache:
        return postprocess_fa(cache[key])
    if en in cache:
        return postprocess_fa(cache[en])
    return None


def write_entries(entries: list[dict], cache: dict[str, str]) -> dict:
    missing_fa = 0
    for e in entries:
        sense_fas: list[str] = []
        new_senses = []
        for sense in e.get("senses") or [{"en": e["en"], "fa": None}]:
            fa = ENTRY_FALLBACKS.get(e["tk"]) or resolve_fa(sense["en"], cache)
            if not fa:
                missing_fa += 1
            new_senses.append({"en": sense["en"], "fa": fa})
            if fa:
                sense_fas.append(fa)
        e["senses"] = new_senses
        e["fa"] = "؛ ".join(sense_fas) if sense_fas else None
        e["fa_status"] = "mt_draft" if e["fa"] else "missing"

    OUT_PATH.write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8")
    stats = {
        "total_entries": len(entries),
        "fa_status": "mt_draft",
        "fa_filled": sum(1 for e in entries if e.get("fa")),
        "fa_missing_senses": missing_fa,
        "fa_cache_size": len(cache),
    }
    stats_path = CANON / "stats.json"
    prev = json.loads(stats_path.read_text(encoding="utf-8")) if stats_path.exists() else {}
    prev.update(stats)
    stats_path.write_text(json.dumps(prev, ensure_ascii=False, indent=2), encoding="utf-8")
    return stats


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--skip-mt", action="store_true")
    parser.add_argument("--max-new", type=int, default=0, help="Translate at most N new senses this run")
    args = parser.parse_args()

    entries = json.loads(IN_PATH.read_text(encoding="utf-8"))
    if args.limit:
        entries = entries[: args.limit]

    cache = load_cache()
    unique: list[str] = []
    seen: set[str] = set()
    for e in entries:
        for sense in e.get("senses") or [{"en": e["en"]}]:
            key = clean_en_for_mt(sense["en"]) or sense["en"]
            if key in seen or key in GLOSS_OVERRIDES:
                continue
            if not looks_english_gloss(key):
                continue
            seen.add(key)
            unique.append(key)

    missing = [t for t in unique if t not in cache]
    if args.max_new:
        missing = missing[: args.max_new]
    print(
        f"entries={len(entries)} unique_en={len(unique)} cache={len(cache)} missing={len(missing)}",
        flush=True,
    )
    if not args.skip_mt and missing:
        translate_batch_safe(missing, cache)

    stats = write_entries(entries, cache)
    print(json.dumps({"wrote": str(OUT_PATH), **stats}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
