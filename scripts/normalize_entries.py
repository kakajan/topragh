#!/usr/bin/env python3
"""Deprecated shim — use scripts/normalize-entries.ts (P0 canonicalizer)."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TS = ROOT / "scripts" / "normalize-entries.ts"


def main() -> int:
    print("normalize_entries.py is deprecated; running normalize-entries.ts …", file=sys.stderr)
    try:
        return subprocess.call(["node", "--experimental-strip-types", str(TS)], cwd=ROOT)
    except FileNotFoundError:
        print(
            "Install Node.js ≥22 or Bun, then run:\n"
            "  node --experimental-strip-types scripts/normalize-entries.ts",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
