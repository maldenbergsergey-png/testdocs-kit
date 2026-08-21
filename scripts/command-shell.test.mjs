import assert from "node:assert/strict";
import test from "node:test";

import { requiresShell } from "./command-shell.mjs";

test("uses a shell for Windows batch launchers", () => {
  assert.equal(requiresShell("npm.cmd", "win32"), true);
  assert.equal(requiresShell("tool.BAT", "win32"), true);
});

test("keeps native executables and non-Windows commands direct", () => {
  assert.equal(requiresShell("node.exe", "win32"), false);
  assert.equal(requiresShell("npm", "linux"), false);
  assert.equal(requiresShell("npm", "darwin"), false);
});
