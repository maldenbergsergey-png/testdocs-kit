import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { repoRoot } from "./paths.mjs";

for (const format of ["stable", "v2"]) {
  test(`browser install, reuse, mode switch and disable preserve unrelated ${format} configuration`, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "testdocs-browser-install-"));
    try {
      const target = path.join(root, "opencode.json");
      const foreign = { type: "local", command: ["foreign-tool"] };
      fs.writeFileSync(target, JSON.stringify({ mcp: format === "v2" ? { servers: { foreign } } : { foreign }, permission: { custom: "ask" } }));
      const answers = path.join(root, "answers.json");
      fs.writeFileSync(answers, JSON.stringify({ version: 3, connections: {}, tms: { category: "none" }, browser: { enabled: true, mode: "persistent" } }));
      const env = { ...process.env, TESTDOCS_INSTALL_ROOT: root, TESTDOCS_CONFIG_DIR: path.join(root, "private"), TESTDOCS_OPENCODE_CONFIG: target };
      delete env.TESTDOCS_CONFIG_FILE;
      let first = true;
      for (const mode of ["persistent", "persistent", "extension", "off"]) {
        const input = first ? ["--answers", answers] : ["--reuse"];
        first = false;
        const result = spawnSync(process.execPath, ["scripts/install.mjs", "--clients", "opencode", ...input, "--opencode-format", format, "--browser-mode", mode, "--skip-dependencies", "--no-cli"], { cwd: repoRoot, env, encoding: "utf8", timeout: 30000 });
        assert.equal(result.status, 0, result.stdout + result.stderr);
        const config = JSON.parse(fs.readFileSync(target, "utf8"));
        const servers = format === "v2" ? config.mcp.servers : config.mcp;
        assert.deepEqual(servers.foreign, foreign);
        assert.equal(config.permission.custom, "ask");
        if (mode === "off") assert.equal(servers.testdocs_browser, undefined);
        else {
          assert.equal(servers.testdocs_browser.command.at(-1), "browser");
          assert.equal(format === "v2" ? servers.testdocs_browser.disabled : !servers.testdocs_browser.enabled, false);
          assert.match(result.stdout, /Playwright MCP: tools available/);
        }
        const saved = JSON.parse(fs.readFileSync(path.join(root, "private", "config.json"), "utf8"));
        assert.equal(saved.browser.enabled, mode !== "off");
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}
