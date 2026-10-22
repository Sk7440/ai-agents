"""Export the student glossary (glossary.json), matched against the main glossary, for the web app.

Run from api/:  uv run python -m app.export_glossary
Writes web/app/lib/demo/glossary.generated.json. Re-run whenever glossary.json changes.
"""

import json
import re
import sys
from pathlib import Path

from .glossary import load_student_glossary, normalize, student_entry, student_match

OUT = Path(__file__).resolve().parents[2] / "web" / "app" / "lib" / "demo" / "glossary.generated.json"


def split_term(term: str, key: str) -> tuple[str, str | None, list[str]]:
    """'Large Language Model (LLM)' -> name, fullName, aliases, using the key the student glossary uses."""
    m = re.match(r"^(.*?)\s*\((.+)\)$", term)
    if not m:
        return term, None, []
    long, short = m.group(1), m.group(2)
    if key.replace("-", "").lower().rstrip("s") == short.replace("-", "").lower().rstrip("s"):  # "gans" ~ "GAN"
        return short, long, [long]
    return long, None, [short]


def export() -> list[dict]:
    items = []
    for key, raw_definition in load_student_glossary().items():
        own = student_entry(key, raw_definition)  # strips "Expansion - " prefixes
        entry = student_match(key)
        nk, nt = normalize(key).rstrip("s"), normalize(entry["term"])
        if entry is not own and nk not in nt and nt.split(" (")[0] not in nk:
            entry = {**own, "aliases": own["aliases"]}  # matched a neighbour (weights -> parameters): keep it separate
        name, full, extra = split_term(entry["term"], key)
        quiz = entry.get("quiz")
        items.append({
            "key": key,
            "id": re.sub(r"[^a-z0-9]+", "-", key.lower()).strip("-"),
            "name": name,
            "fullName": full,
            "aliases": sorted({key, *extra, *entry.get("aliases", [])} - {name}),
            "category": entry["category"],
            "definition": own["definition"],
            "mentalModel": entry.get("mental_model") or None,
            "example": entry.get("example") or None,
            "quiz": quiz or None,
        })
    return items


def main() -> None:
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else OUT
    items = export()
    out.write_text(json.dumps(items, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(items)} terms to {out}")


if __name__ == "__main__":
    main()
