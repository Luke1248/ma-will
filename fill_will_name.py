"""Utility for inserting a Massachusetts resident's name into the provided will template."""
from __future__ import annotations

import argparse
import re
from pathlib import Path
from typing import Iterable
import zipfile


PLACEHOLDER = "[TESTATOR NAME]"


def slugify(name: str) -> str:
    """Create a filesystem-friendly slug from the provided name."""
    cleaned = name.strip()
    if not cleaned:
        raise ValueError("Name must not be empty.")
    slug = re.sub(r"[^A-Za-z0-9]+", "-", cleaned).strip("-")
    return slug or "will"


def fill_name(template: Path, output: Path, name: str) -> None:
    """Fill the will template with the provided testator name."""
    with zipfile.ZipFile(template) as src_zip:
        with zipfile.ZipFile(output, "w") as dst_zip:
            for info in src_zip.infolist():
                data = src_zip.read(info.filename)
                if info.filename == "word/document.xml":
                    text = data.decode("utf-8")
                    replaced = text.replace(PLACEHOLDER, name)
                    if replaced == text:
                        raise ValueError(
                            f"Placeholder {PLACEHOLDER!r} was not found in the template."
                        )
                    data = replaced.encode("utf-8")
                dst_zip.writestr(info, data)



def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Create a personalized Massachusetts will by inserting the testator's name "
            "into the official template."
        )
    )
    parser.add_argument(
        "name",
        help="Full legal name of the Massachusetts resident who is the testator.",
    )
    parser.add_argument(
        "--template",
        type=Path,
        default=Path("Will for Single Individual_ Basic (MA).docx"),
        help="Path to the template Word document.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help=(
            "Path to the output Word document. Defaults to a file derived from the "
            "resident's name."
        ),
    )
    return parser


def main(argv: Iterable[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)

    template: Path = args.template
    if not template.exists():
        raise SystemExit(f"Template not found: {template}")

    name: str = args.name.strip()
    if not name:
        raise SystemExit("Name must not be empty.")

    output: Path
    if args.output:
        output = args.output
    else:
        slug = slugify(name)
        output = template.with_name(f"Will_for_{slug}.docx")

    fill_name(template, output, name)
    print(f"Created will with name '{name}' at: {output}")


if __name__ == "__main__":
    main()
