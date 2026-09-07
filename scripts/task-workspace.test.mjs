import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "task-workspace.mjs");

test("task workspace is isolated by project and survives reinitialization", () => {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), "testdocs-workspace-"));
  const env = { ...process.env, TESTDOCS_DATA_DIR: dataRoot };
  try {
    const first = spawnSync(process.execPath, [script, "init", "--project", "Project A", "--task", "TASK-123", "--json"], { env, encoding: "utf8" });
    assert.equal(first.status, 0, first.stderr);
    const workspace = JSON.parse(first.stdout);
    assert.ok(workspace.path.startsWith(dataRoot));
    for (const name of ["reports", "evidence", "attachments", "requests"]) {
      assert.ok(fs.statSync(path.join(workspace.path, name)).isDirectory());
    }

    const evidence = path.join(workspace.path, "evidence", "1-actual-01.txt");
    fs.writeFileSync(evidence, "kept", "utf8");
    const second = spawnSync(process.execPath, [script, "init", "--project", "Project A", "--task", "TASK-123", "--json"], { env, encoding: "utf8" });
    assert.equal(second.status, 0, second.stderr);
    assert.equal(JSON.parse(second.stdout).path, workspace.path);
    assert.equal(fs.readFileSync(evidence, "utf8"), "kept");

    const other = spawnSync(process.execPath, [script, "init", "--project", "Project B", "--task", "TASK-123", "--json"], { env, encoding: "utf8" });
    assert.equal(other.status, 0, other.stderr);
    assert.notEqual(JSON.parse(other.stdout).path, workspace.path);
  } finally {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
});
