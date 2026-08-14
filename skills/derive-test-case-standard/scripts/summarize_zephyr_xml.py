#!/usr/bin/env python3
"""Summarize Zephyr Scale XML exports by project, structure, and review signals.

Uses only the Python standard library. Cases are deduplicated by Zephyr key before
aggregate metrics are calculated. Lexical simplicity signals require human review;
they are not automatic defects. The script never modifies source exports.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import statistics
import sys
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


TECHNICAL_DETAIL_PATTERN = re.compile(
    r"(?:\bapi\b|апи[- ]?метод|/api/|баз[аеуы] данных|\bбд\b|\bsql\b|"
    r"http[- ]?метод|метод\s+(?:get|post|put|patch|delete)\b)",
    re.IGNORECASE,
)
VAGUE_RESULT_PATTERN = re.compile(
    r"(?:работает корректно|корректно работает|стандартн\w* поведени\w*|"
    r"доступн\w* к взаимодействию|соответствует требованиям/?макету|"
    r"согласно требованиям/?макету)",
    re.IGNORECASE,
)
STEP_REFERENCE_PATTERN = re.compile(
    r"(?:повторить\s+(?:шаг\s*)?\d+|вернуться\s+к\s+шагу\s*\d+)",
    re.IGNORECASE,
)
ADMIN_CONTEXT_PATTERN = re.compile(
    r"(?:админк\w*|административн\w+ панел\w*|панел\w+ управления|бэкенд)",
    re.IGNORECASE,
)


def text(element: ET.Element, path: str) -> str:
    value = element.findtext(path)
    return value.strip() if value else ""


def case_record(test_case: ET.Element, source: Path, project_key: str) -> dict[str, Any]:
    script = test_case.find("testScript")
    steps = test_case.findall("./testScript/steps/step")
    path_value = ""
    for field in test_case.findall("./customFields/customField"):
        if field.get("name") == "Путь":
            path_value = text(field, "value")
            break

    step_records = [
        {
            "description": text(step, "description"),
            "expected_result": text(step, "expectedResult"),
            "test_data": text(step, "testData"),
        }
        for step in steps
    ]

    return {
        "key": test_case.get("key", "").strip(),
        "project_key": project_key,
        "id": test_case.get("id", "").strip(),
        "source": str(source),
        "name": text(test_case, "name"),
        "objective": text(test_case, "objective"),
        "precondition": text(test_case, "precondition"),
        "folder": text(test_case, "folder"),
        "priority": text(test_case, "priority"),
        "status": text(test_case, "status") or "<empty>",
        "path": path_value,
        "script_type": script.get("type", "<empty>") if script is not None else "<missing>",
        "labels": [label.text.strip() for label in test_case.findall("./labels/label") if label.text],
        "issues": [text(issue, "key") for issue in test_case.findall("./issues/issue") if text(issue, "key")],
        "steps": step_records,
    }


def fingerprint(record: dict[str, Any]) -> str:
    compared = {key: value for key, value in record.items() if key != "source"}
    payload = json.dumps(compared, ensure_ascii=False, sort_keys=True).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def plain_markup(value: str) -> str:
    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.IGNORECASE)
    value = re.sub(r"<li[^>]*>", "- ", value, flags=re.IGNORECASE)
    value = re.sub(r"</li>", "\n", value, flags=re.IGNORECASE)
    value = re.sub(r"<img[^>]*>", "[image]", value, flags=re.IGNORECASE)
    value = re.sub(r"<[^>]+>", "", value)
    value = html.unescape(value).replace("\u00a0", " ")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in value.splitlines()]
    return "\n".join(line for line in lines if line)


def printable_case(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "key": record["key"],
        "project_key": record["project_key"],
        "name": plain_markup(record["name"]),
        "status": record["status"],
        "folder": record["folder"],
        "objective": plain_markup(record["objective"]),
        "precondition": plain_markup(record["precondition"]),
        "priority": record["priority"],
        "path": plain_markup(record["path"]),
        "labels": record["labels"],
        "issues": record["issues"],
        "steps": [
            {
                "description": plain_markup(step["description"]),
                "expected_result": plain_markup(step["expected_result"]),
                "test_data": plain_markup(step["test_data"]),
            }
            for step in record["steps"]
        ],
    }


def first_token(value: str) -> str:
    plain = plain_markup(value)
    match = re.search(r"[A-Za-zА-Яа-яЁё]+", plain)
    return match.group(0).lower() if match else "<empty>"


def quality_metrics(records: list[dict[str, Any]]) -> dict[str, int]:
    steps = [step for record in records for step in record["steps"]]
    return {
        "cases": len(records),
        "cases_with_objective": sum(bool(record["objective"]) for record in records),
        "cases_with_precondition": sum(bool(record["precondition"]) for record in records),
        "steps": len(steps),
        "steps_without_description": sum(not step["description"] for step in steps),
        "steps_without_expected_result": sum(not step["expected_result"] for step in steps),
        "steps_with_image_only_expected_result": sum(
            "<img" in step["expected_result"].lower()
            and not plain_markup(step["expected_result"]).replace("[image]", "").strip()
            for step in steps
        ),
        "steps_with_test_data": sum(bool(step["test_data"]) for step in steps),
    }


def type_step_metrics(records: list[dict[str, Any]], tag: str, minimum: int, maximum: int) -> dict[str, int]:
    selected = [record for record in records if tag in record["labels"]]
    counts = [len(record["steps"]) for record in selected]
    return {
        "cases": len(selected),
        "below_recommended_minimum": sum(count < minimum for count in counts),
        "above_recommended_maximum": sum(count > maximum for count in counts),
        "above_15_steps": sum(count > 15 for count in counts),
    }


def simplicity_review_metrics(records: list[dict[str, Any]]) -> dict[str, Any]:
    technical_cases: set[str] = set()
    vague_cases: set[str] = set()
    step_reference_cases: set[str] = set()
    admin_cases: set[str] = set()
    technical_steps = 0
    vague_result_steps = 0
    step_reference_steps = 0

    for record in records:
        case_text = " ".join(
            plain_markup(record[field])
            for field in ("name", "objective", "precondition", "folder", "path")
        )
        if ADMIN_CONTEXT_PATTERN.search(case_text):
            admin_cases.add(record["key"])

        for step in record["steps"]:
            action = plain_markup(step["description"])
            result = plain_markup(step["expected_result"])
            data = plain_markup(step["test_data"])
            combined = " ".join((action, result, data))
            if TECHNICAL_DETAIL_PATTERN.search(combined):
                technical_steps += 1
                technical_cases.add(record["key"])
            if VAGUE_RESULT_PATTERN.search(result):
                vague_result_steps += 1
                vague_cases.add(record["key"])
            if STEP_REFERENCE_PATTERN.search(action):
                step_reference_steps += 1
                step_reference_cases.add(record["key"])
            if ADMIN_CONTEXT_PATTERN.search(combined):
                admin_cases.add(record["key"])

    return {
        "note": "Lexical review signals only; inspect context before treating any signal as a defect.",
        "cases_with_technical_detail_signal": len(technical_cases),
        "steps_with_technical_detail_signal": technical_steps,
        "cases_with_vague_expected_result_signal": len(vague_cases),
        "steps_with_vague_expected_result_signal": vague_result_steps,
        "cases_with_step_reference_signal": len(step_reference_cases),
        "steps_with_step_reference_signal": step_reference_steps,
        "cases_with_administration_context": len(admin_cases),
    }


def parse_exports(paths: list[Path]) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    records: list[dict[str, Any]] = []
    projects: list[dict[str, str]] = []
    for path in paths:
        root = ET.parse(path).getroot()
        project_key = text(root, "projectKey")
        projects.append(
            {
                "source": str(path),
                "project_key": project_key,
                "export_date": text(root, "exportDate"),
            }
        )
        records.extend(
            case_record(test_case, path, project_key)
            for test_case in root.findall("./testCases/testCase")
        )
    return records, projects


def summarize(records: list[dict[str, Any]], projects: list[dict[str, str]]) -> dict[str, Any]:
    by_key: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for index, record in enumerate(records):
        raw_key = record["key"] or f"<missing-key:{index}>"
        key = f"{record['project_key']}:{raw_key}"
        by_key[key].append(record)

    duplicated = {key: values for key, values in by_key.items() if len(values) > 1}
    conflicting = {
        key: values
        for key, values in duplicated.items()
        if len({fingerprint(value) for value in values}) > 1
    }

    unique_records = [values[0] for values in by_key.values()]
    step_counts = [len(record["steps"]) for record in unique_records]
    all_steps = [step for record in unique_records for step in record["steps"]]

    field_names = ["name", "objective", "precondition", "folder", "priority", "path"]
    fields_present = {
        field: sum(bool(record[field]) for record in unique_records) for field in field_names
    }

    labels = Counter(label for record in unique_records for label in record["labels"])
    type_tags = {"e2e", "overview", "block", "cross", "integration"}
    platform_tags = {"web", "app", "web_mobile"}
    statuses = Counter(record["status"] for record in unique_records)
    priorities = Counter(record["priority"] or "<empty>" for record in unique_records)
    script_types = Counter(record["script_type"] for record in unique_records)
    records_by_status: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in unique_records:
        records_by_status[record["status"]].append(record)

    step_openers = Counter(first_token(step["description"]) for step in all_steps)
    expected_openers = Counter(first_token(step["expected_result"]) for step in all_steps)
    title_prefixes = Counter(
        plain_markup(record["name"]).split(".", 1)[0].strip() or "<empty>"
        for record in unique_records
    )
    folder_depth_2 = Counter(
        "/".join(record["folder"].split("/")[:2]) or "<empty>"
        for record in unique_records
    )
    folder_depth_3 = Counter(
        "/".join(record["folder"].split("/")[:3]) or "<empty>"
        for record in unique_records
    )
    names = Counter(plain_markup(record["name"]) for record in unique_records)
    project_counts = Counter(record["project_key"] or "<unknown>" for record in unique_records)

    return {
        "projects": projects,
        "project_case_counts": dict(project_counts.most_common()),
        "raw_case_occurrences": len(records),
        "unique_cases": len(unique_records),
        "duplicate_occurrences": len(records) - len(unique_records),
        "duplicated_keys": len(duplicated),
        "conflicting_duplicate_keys": sorted(conflicting),
        "status_counts": dict(statuses.most_common()),
        "priority_counts": dict(priorities.most_common()),
        "script_type_counts": dict(script_types.most_common()),
        "fields_present": fields_present,
        "case_count_with_issues": sum(bool(record["issues"]) for record in unique_records),
        "issue_link_count": sum(len(record["issues"]) for record in unique_records),
        "case_count_with_url_in_objective": sum(
            bool(re.search(r"https?://", record["objective"])) for record in unique_records
        ),
        "case_count_with_labels": sum(bool(record["labels"]) for record in unique_records),
        "classification_completeness": {
            "cases_with_type_tag": sum(bool(type_tags.intersection(record["labels"])) for record in unique_records),
            "cases_with_platform_tag": sum(bool(platform_tags.intersection(record["labels"])) for record in unique_records),
            "cases_with_type_and_platform_tags": sum(
                bool(type_tags.intersection(record["labels"]))
                and bool(platform_tags.intersection(record["labels"]))
                for record in unique_records
            ),
        },
        "type_step_range_review": {
            "e2e": type_step_metrics(unique_records, "e2e", 5, 15),
            "overview": type_step_metrics(unique_records, "overview", 3, 8),
            "block": type_step_metrics(unique_records, "block", 5, 12),
        },
        "simplicity_review_signals": simplicity_review_metrics(unique_records),
        "top_labels": dict(labels.most_common(20)),
        "top_title_prefixes": dict(title_prefixes.most_common(20)),
        "folder_counts_depth_2": dict(folder_depth_2.most_common()),
        "top_folder_counts_depth_3": dict(folder_depth_3.most_common(20)),
        "duplicated_case_names": {
            name: count for name, count in names.most_common() if count > 1
        },
        "top_step_openers": dict(step_openers.most_common(20)),
        "top_expected_result_openers": dict(expected_openers.most_common(20)),
        "quality_by_status": {
            status: quality_metrics(status_records)
            for status, status_records in sorted(records_by_status.items())
        },
        "step_statistics": {
            "total": len(all_steps),
            "cases_without_steps": sum(count == 0 for count in step_counts),
            "minimum_per_case": min(step_counts, default=0),
            "median_per_case": statistics.median(step_counts) if step_counts else 0,
            "mean_per_case": round(statistics.mean(step_counts), 2) if step_counts else 0,
            "maximum_per_case": max(step_counts, default=0),
            "cases_with_at_least_20_steps": sum(count >= 20 for count in step_counts),
            "cases_with_at_least_30_steps": sum(count >= 30 for count in step_counts),
            "with_description": sum(bool(step["description"]) for step in all_steps),
            "with_expected_result": sum(bool(step["expected_result"]) for step in all_steps),
            "with_test_data": sum(bool(step["test_data"]) for step in all_steps),
        },
        "_unique_records": unique_records,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("exports", nargs="+", type=Path, help="Zephyr Scale XML export paths")
    parser.add_argument("--sample-size", type=int, default=0, help="Include up to N case summaries")
    parser.add_argument(
        "--sample-status",
        action="append",
        default=[],
        help="Limit samples to a status; repeat for multiple statuses",
    )
    parser.add_argument(
        "--case-key",
        action="append",
        default=[],
        help="Include a plain-text case record for this key; repeat for multiple keys",
    )
    args = parser.parse_args()

    missing = [str(path) for path in args.exports if not path.is_file()]
    if missing:
        parser.error(f"files not found: {', '.join(missing)}")

    try:
        records, projects = parse_exports(args.exports)
    except ET.ParseError as error:
        print(f"Invalid XML: {error}", file=sys.stderr)
        return 2

    result = summarize(records, projects)
    unique_records = result.pop("_unique_records")
    if args.sample_size > 0:
        eligible = [
            record
            for record in unique_records
            if not args.sample_status or record["status"] in args.sample_status
        ]
        result["samples"] = [
            {
                "key": record["key"],
                "name": record["name"],
                "status": record["status"],
                "folder": record["folder"],
                "step_count": len(record["steps"]),
            }
            for record in eligible[: args.sample_size]
        ]
    if args.case_key:
        result["selected_cases"] = [
            printable_case(record)
            for record in unique_records
            if record["key"] in args.case_key
        ]
        selected_keys = {record["key"] for record in unique_records}
        missing_keys = [key for key in args.case_key if key not in selected_keys]
        if missing_keys:
            result["missing_case_keys"] = missing_keys

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
