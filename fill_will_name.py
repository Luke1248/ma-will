"""Populate all fillable placeholders in the Massachusetts will template."""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Sequence
from xml.sax.saxutils import escape
import zipfile


TEMPLATE_DEFAULT = Path("Will for Single Individual_ Basic (MA).docx")


@dataclass(slots=True)
class Placeholder:
    """A placeholder token discovered in the Word template."""

    token: str
    key: str | None
    content: str
    optional: bool
    occurrences: int

    @property
    def description(self) -> str:
        """Human-readable description of the placeholder."""

        if self.key is None:
            return "Complex bracketed clause"
        return self.content


def read_document_xml(template: Path) -> str:
    """Read the document.xml payload from a DOCX template."""

    with zipfile.ZipFile(template) as src_zip:
        return src_zip.read("word/document.xml").decode("utf-8")


def write_document_xml(template: Path, output: Path, xml_text: str) -> None:
    """Write the updated document.xml into a new DOCX archive."""

    with zipfile.ZipFile(template) as src_zip:
        with zipfile.ZipFile(output, "w") as dst_zip:
            for info in src_zip.infolist():
                data = src_zip.read(info.filename)
                if info.filename == "word/document.xml":
                    data = xml_text.encode("utf-8")
                dst_zip.writestr(info, data)


def extract_tokens(xml_text: str) -> Sequence[str]:
    """Extract all bracketed tokens from the XML text in document order."""

    tokens: List[str] = []
    stack: List[str] = []
    for ch in xml_text:
        if ch == "[":
            stack.append("[")
        elif ch == "]":
            if stack:
                current = stack.pop() + "]"
                tokens.append(current)
                if stack:
                    stack[-1] += current
        else:
            if stack:
                stack[-1] += ch
    return tokens


def normalize_key(content: str, used: set[str]) -> str:
    """Generate a stable uppercase key for a placeholder."""

    base = re.sub(r"[^0-9A-Za-z]+", "_", content.strip()).strip("_")
    base = re.sub(r"_+", "_", base)
    key = base.upper() or "FIELD"
    suffix = 1
    final = key
    while final in used:
        suffix += 1
        final = f"{key}_{suffix}"
    used.add(final)
    return final


def categorize_placeholders(tokens: Sequence[str]) -> List[Placeholder]:
    """Create Placeholder objects for the unique tokens in the template."""

    counts: Dict[str, int] = {}
    for token in tokens:
        counts[token] = counts.get(token, 0) + 1

    placeholders: List[Placeholder] = []
    seen: set[str] = set()
    used_keys: set[str] = set()
    for token in tokens:
        if token in seen:
            continue
        seen.add(token)
        content = token[1:-1]
        contains_markup = "<" in token or ">" in token
        optional = any(ch.islower() for ch in content if ch.isalpha())
        key: str | None
        if contains_markup:
            key = None
        else:
            key = normalize_key(content, used_keys)
        placeholders.append(
            Placeholder(
                token=token,
                key=key,
                content=content,
                optional=optional,
                occurrences=counts[token],
            )
        )
    return placeholders


def load_values(args: argparse.Namespace) -> Dict[str, str]:
    """Combine JSON-sourced values, CLI assignments, and positional name."""

    values: Dict[str, str] = {}

    if args.values:
        try:
            raw = json.loads(Path(args.values).read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:  # pragma: no cover - user error path
            raise SystemExit(f"Failed to parse JSON file {args.values}: {exc}") from exc
        if not isinstance(raw, dict):  # pragma: no cover - user error path
            raise SystemExit("JSON values file must contain an object mapping keys to values.")
        for key, value in raw.items():
            values[str(key).upper()] = str(value)

    if args.set:
        for assignment in args.set:
            if "=" not in assignment:  # pragma: no cover - user error path
                raise SystemExit(
                    f"Invalid --set argument {assignment!r}; expected KEY=VALUE format."
                )
            key, raw_value = assignment.split("=", 1)
            values[key.upper()] = raw_value

    if args.name:
        values.setdefault("TESTATOR_NAME", args.name)

    # Trim whitespace from all values for cleanliness.
    return {key: value.strip() for key, value in values.items()}


def generate_sample(path: Path, placeholders: Sequence[Placeholder]) -> None:
    """Write a JSON file describing every fillable placeholder."""

    sample: Dict[str, str] = {}
    for placeholder in placeholders:
        if placeholder.key is None:
            continue
        if placeholder.optional:
            sample[placeholder.key] = placeholder.content
        else:
            sample[placeholder.key] = ""
    path.write_text(json.dumps(sample, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def print_placeholder_table(placeholders: Sequence[Placeholder]) -> None:
    """Display a table of placeholders, their keys, and whether they are optional."""

    header = f"{'KEY':<40} {'OCCURRENCES':>11} {'OPTIONAL':>9}  DESCRIPTION"
    print(header)
    print("-" * len(header))
    for placeholder in placeholders:
        key = placeholder.key or "(auto)"
        optional = "yes" if placeholder.optional else "no"
        print(
            f"{key:<40} {placeholder.occurrences:>11} {optional:>9}  "
            f"{placeholder.description}"
        )


def apply_replacements(
    xml_text: str,
    placeholders: Sequence[Placeholder],
    values: Dict[str, str],
    allow_missing: bool,
) -> str:
    """Apply user-provided values to the placeholder tokens."""

    missing: List[str] = []
    updated = xml_text

    for placeholder in reversed(placeholders):
        if placeholder.key is None:
            # Complex clause: remove outer brackets but keep inner XML structure.
            updated = updated.replace(placeholder.token, placeholder.token[1:-1])
            continue

        replacement: str | None
        if placeholder.key in values:
            replacement = escape(values[placeholder.key])
        else:
            if placeholder.optional:
                replacement = placeholder.content
            else:
                missing.append(placeholder.key)
                replacement = None

        if replacement is not None:
            updated = updated.replace(placeholder.token, replacement)

    if missing and not allow_missing:
        missing_str = ", ".join(sorted(missing))
        raise SystemExit(
            "Missing required values for placeholders: "
            f"{missing_str}. Use --set or a JSON file to supply them."
        )

    return updated


def ensure_no_placeholders(xml_text: str) -> None:
    """Verify that the document no longer contains any bracketed prompts."""

    remaining = [token for token in extract_tokens(xml_text) if "<" not in token and ">" not in token]
    if remaining:
        preview = ", ".join(sorted(set(remaining))[:5])
        raise SystemExit(
            "The output document still contains unresolved placeholders, including: "
            f"{preview}"
        )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Fill the Massachusetts will template with resident-specific information. "
            "Values can be provided individually via --set or through a JSON mapping."
        )
    )
    parser.add_argument(
        "name",
        nargs="?",
        help=(
            "Shortcut for setting TESTATOR_NAME. When omitted, supply the value via "
            "--set or the JSON file."
        ),
    )
    parser.add_argument(
        "--template",
        type=Path,
        default=TEMPLATE_DEFAULT,
        help="Path to the template Word document.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help=(
            "Path to the output Word document. Defaults to appending '_filled' to the "
            "template name."
        ),
    )
    parser.add_argument(
        "--values",
        type=Path,
        help="JSON file mapping placeholder keys to replacement text.",
    )
    parser.add_argument(
        "--set",
        action="append",
        metavar="KEY=VALUE",
        help="Set or override an individual placeholder value. May be provided multiple times.",
    )
    parser.add_argument(
        "--list-placeholders",
        action="store_true",
        help="List all discovered placeholders and exit without modifying the document.",
    )
    parser.add_argument(
        "--generate-sample",
        type=Path,
        help="Write a JSON file containing every placeholder key and an example value.",
    )
    parser.add_argument(
        "--allow-missing",
        action="store_true",
        help="Allow required placeholders to remain unresolved.",
    )
    return parser


def main(argv: Iterable[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)

    template: Path = args.template
    if not template.exists():
        raise SystemExit(f"Template not found: {template}")

    xml_text = read_document_xml(template)
    tokens = extract_tokens(xml_text)
    placeholders = categorize_placeholders(tokens)

    if args.list_placeholders:
        print_placeholder_table(placeholders)
        if not any([args.values, args.set, args.generate_sample, args.output, args.name]):
            return

    generated_sample = False
    if args.generate_sample:
        generate_sample(Path(args.generate_sample), placeholders)
        generated_sample = True

    if generated_sample and not any([args.values, args.set, args.name]):
        return

    values = load_values(args)

    updated_xml = apply_replacements(
        xml_text,
        placeholders,
        values,
        allow_missing=args.allow_missing,
    )

    if not args.allow_missing:
        ensure_no_placeholders(updated_xml)

    output = args.output
    if not output:
        output = template.with_name(template.stem + "_filled" + template.suffix)

    write_document_xml(template, output, updated_xml)
    print(f"Created completed will at: {output}")


if __name__ == "__main__":
    main()
