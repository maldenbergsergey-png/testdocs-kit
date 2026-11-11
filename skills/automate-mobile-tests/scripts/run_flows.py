#!/usr/bin/env python3
"""Run a saved mobile flow on one prepared device and verify this run's JUnit."""

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET


def check_report(report):
    root = ET.parse(report).getroot()
    if root.tag.rsplit("}", 1)[-1] not in {"testsuite", "testsuites"}:
        raise ValueError("Expected a JUnit test suite.")
    passed = failed = skipped = 0
    suite_failed = False
    for node in root.iter():
        tag = node.tag.rsplit("}", 1)[-1]
        if tag in {"testsuite", "testsuites"}:
            if any(int(node.get(key, "0")) > 0 for key in ("errors", "failures")):
                suite_failed = True
        elif tag == "testcase":
            outcomes = {child.tag.rsplit("}", 1)[-1] for child in node}
            status = node.get("status", "").lower()
            if outcomes & {"error", "failure"} or status in {"error", "failed", "failure"}:
                failed += 1
            elif "skipped" in outcomes or status in {"skipped", "disabled", "notrun", "pending"}:
                skipped += 1
            else:
                passed += 1
    print(f"JUnit: {passed} passed, {failed} failed, {skipped} skipped")
    if not (passed or failed):
        raise ValueError("No tests executed in this run.")
    return 1 if failed or suite_failed else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("flows", type=Path, help="saved flow file or suite directory")
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--device", help="Android serial or iOS Simulator UDID for Maestro CLI")
    target.add_argument("--appium-caps", type=Path, help="private capabilities JSON for the selected iPhone")
    parser.add_argument("--appium-url", help="Appium Server endpoint for that iPhone")
    parser.add_argument("--app-id", help="set the flow variable APP_ID to this package or bundle ID")
    parser.add_argument("--output", type=Path, help="parent for a new run directory (default: system temp)")
    args = parser.parse_args()

    if not (args.flows.is_file() or args.flows.is_dir()):
        parser.error("Flow file or suite directory does not exist.")
    if args.device is not None and (not args.device.strip() or "," in args.device):
        parser.error("Select one device ID per run.")
    if bool(args.appium_url) != bool(args.appium_caps):
        parser.error("Pass --appium-url and --appium-caps together.")
    if args.appium_caps:
        caps = json.loads(args.appium_caps.read_text(encoding="utf-8"))
        if not isinstance(caps, dict) or not isinstance(caps.get("appium:options", {}), dict):
            parser.error("Expected an Appium capabilities object.")
        if str(caps.get("platformName", "iOS")).lower() != "ios":
            parser.error("The Appium target is a physical iPhone. Check platformName.")
        udid = caps.get("appium:options", {}).get("udid", caps.get("appium:udid"))
        if not isinstance(udid, str) or not udid.strip():
            parser.error("Appium capabilities must identify the selected iPhone by UDID.")
        runner = "maestro-runner"
    else:
        runner = "maestro"
    executable = shutil.which(runner)
    if not executable:
        parser.error(f"{runner} not found in PATH.")
    if os.name == "nt" and Path(executable).suffix.lower() in {".cmd", ".bat"}:
        parser.error("Run the native Maestro command in PowerShell, or use this launcher in WSL.")

    if args.output:
        args.output.mkdir(parents=True, exist_ok=True)
    run_dir = Path(tempfile.mkdtemp(prefix="mobile-tests-", dir=args.output)).resolve()
    print(f"Artifacts: {run_dir}", flush=True)
    if args.appium_caps:
        report = run_dir / "junit-report.xml"
        command = [executable, "--platform", "ios", "--driver", "appium",
                   "--appium-url", args.appium_url, "--caps", str(args.appium_caps.resolve()),
                   "test", "--output", str(run_dir), "--flatten"]
    else:
        report = run_dir / "junit.xml"
        command = [executable, "--device", args.device, "test", "--format", "junit",
                   "--output", str(report), "--test-output-dir", str(run_dir / "artifacts")]
    if args.app_id:
        command.extend(["-e", "APP_ID=" + args.app_id])
    command.append(str(args.flows.absolute()))
    code = subprocess.run(command).returncode
    if code:
        return code if code > 0 else 128 - code
    return check_report(report)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, ET.ParseError) as error:
        print(f"Mobile tests: {error}", file=sys.stderr)
        sys.exit(2)
