import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const launcher = fileURLToPath(new URL("../skills/automate-mobile-tests/scripts/run_flows.py", import.meta.url));
const pythonAvailable = process.platform !== "win32" && spawnSync("python3", ["--version"]).status === 0;
const fakeRunner = `#!/usr/bin/env python3
import json, os, pathlib, sys
args = sys.argv[1:]
pathlib.Path(os.environ["ARGS_FILE"]).write_text(json.dumps(args))
out = pathlib.Path(args[args.index("--output") + 1])
if "--flatten" in args:
    out = out / "junit-report.xml"
if os.environ["REPORT"]:
    out.write_text(os.environ["REPORT"])
sys.exit(int(os.environ["RUNNER_CODE"]))
`;

test("saved mobile flows use the selected runner and a fresh JUnit report", {
  skip: !pythonAvailable && "The optional launcher runs with Python 3 on macOS, Linux or WSL"
}, async (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mobile flows ")));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const name of ["maestro", "maestro-runner"]) {
    fs.writeFileSync(path.join(root, name), fakeRunner, { mode: 0o755 });
  }
  const flow = path.join(root, "profile smoke.yaml");
  fs.writeFileSync(flow, "appId: demo.test\n---\n- assertVisible: Profile\n");
  const reports = path.join(root, "reports");
  const argsFile = path.join(root, "args.json");
  const passing = '<testsuites><testsuite tests="1"><testcase name="profile"/></testsuite></testsuites>';
  function run(options, report = passing, code = 0) {
    return spawnSync("python3", [launcher, flow, "--output", reports, ...options], {
      encoding: "utf8",
      env: { ...process.env, PATH: root + path.delimiter + process.env.PATH,
        ARGS_FILE: argsFile, REPORT: report, RUNNER_CODE: String(code) }
    });
  }
  const received = () => JSON.parse(fs.readFileSync(argsFile, "utf8"));
  const device = ["--device", "usb-123"];

  await t.test("hands the saved path, public app ID and device to Maestro", () => {
    const result = run([...device, "--app-id", "test.mobile"]);
    assert.equal(result.status, 0, result.stderr);
    const args = received();
    assert.deepEqual(args.slice(0, 5), ["--device", "usb-123", "test", "--format", "junit"]);
    assert.deepEqual(args.slice(-3), ["-e", "APP_ID=test.mobile", flow]);
    assert.match(result.stdout, /1 passed, 0 failed, 0 skipped/);
  });

  await t.test("uses the specified Appium server and private iPhone capabilities", () => {
    const caps = path.join(root, "private caps.json");
    fs.writeFileSync(caps, JSON.stringify({ "appium:udid": "test-phone" }));
    const endpoint = "http://127.0.0.1:4723";
    const result = run(["--appium-caps", caps, "--appium-url", endpoint]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(received().slice(0, 9),
      ["--platform", "ios", "--driver", "appium", "--appium-url", endpoint, "--caps", caps, "test"]);
  });

  await t.test("a previous green report cannot mask an empty, absent, skipped or failed run", () => {
    for (const report of ["", "<testsuite/>", "<broken", "<testsuite><testcase><skipped/></testcase></testsuite>",
      "<testsuite><testcase><failure/></testcase></testsuite>"]) {
      const result = run(device, report);
      assert.notEqual(result.status, 0, report);
    }
    assert.equal(run(device, passing, 17).status, 17);
  });

  await t.test("an ambiguous target never starts a runner", () => {
    fs.rmSync(argsFile, { force: true });
    const caps = path.join(root, "no device.json");
    fs.writeFileSync(caps, JSON.stringify({ platformName: "iOS" }));
    for (const options of [["--device", "one,two"], ["--appium-caps", caps],
      ["--appium-caps", caps, "--appium-url", "http://127.0.0.1:4723"]]) {
      assert.notEqual(run(options).status, 0);
      assert.equal(fs.existsSync(argsFile), false);
    }
  });
});
