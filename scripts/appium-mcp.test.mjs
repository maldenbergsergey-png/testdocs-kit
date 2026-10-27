import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { repoRoot } from "./paths.mjs";
import { appiumLaunch, appiumSpawnCommand, resolveAppium, validateAppium } from "./appium-config.mjs";

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "testdocs-appium-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const env = {
    ...process.env, TESTDOCS_INSTALL_ROOT: root,
    TESTDOCS_CONFIG_DIR: path.join(root, "private"),
    TESTDOCS_CONFIG_FILE: path.join(root, "private", "config.json"),
    TESTDOCS_DATA_DIR: path.join(root, "data"),
    TESTDOCS_CODEX_CONFIG: path.join(root, "codex.toml"),
    TESTDOCS_OPENCODE_CONFIG: path.join(root, "opencode.json")
  };
  return { root, env };
}

function fakeCli(root, name = "appium-mcp") {
  const command = path.join(root, "CLI with spaces", process.platform === "win32" ? `${name}.cmd` : name);
  fs.mkdirSync(path.dirname(command), { recursive: true });
  const script = process.platform === "win32" ? `${command}.cjs` : command;
  fs.writeFileSync(script, `#!${process.execPath}
const args = process.argv.slice(2);
if (args.join(" ") === "--help") {
  process.stderr.write("Usage: ${name} [options]\\n");
  process.exit(process.env.TESTDOCS_FIXTURE_CLI_FAIL === "1" ? 2 : 0);
} else if (args.length === 0 || args.join(" ") === "mcp") {
  process.stdout.write(JSON.stringify({ args, cwd: process.cwd(), java: process.env.JAVA_HOME, android: process.env.ANDROID_HOME, screenshots: process.env.SCREENSHOTS_DIR, vision: process.env.AI_VISION_ENABLED }) + "\\n");
  process.stderr.write("fixture diagnostic\\n");
  process.stdin.pipe(process.stdout);
} else process.exit(3);
`, { mode: 0o755 });
  if (process.platform === "win32") fs.writeFileSync(command, `@echo off\r\n"${process.execPath}" "${script}" %*\r\n`);
  return command;
}

test("Appium auto detects an installed MCP without requiring Maestro or installing dependencies", (t) => {
  const { root } = fixture(t);
  const env = { PATH: "", TESTDOCS_INSTALL_ROOT: root, APPDATA: root };
  assert.deepEqual(resolveAppium({}, env, root), { mode: "auto", enabled: false });
  assert.throws(() => resolveAppium({ mode: "on" }, env, root), /MCP не найден/);
  const command = fakeCli(root);
  const available = { ...env, PATH: path.dirname(command), SECRET_TOKEN: "never-persist" };
  const found = resolveAppium({}, available, root);
  assert.equal(found.resolvedCommand, command);
  assert.equal(found.enabled, true);
  assert.equal(resolveAppium({ mode: "off" }, available, root).enabled, false);
  assert.equal(resolveAppium({ command: path.join(root, "missing") }, available, root).enabled, false);
  assert.ok(!JSON.stringify(found).includes("never-persist"));
  assert.throws(() => validateAppium({ command: "npx appium-mcp" }), /абсолютный путь/);
  assert.throws(() => validateAppium({ mode: "invalid" }), /режим/);
  assert.throws(() => validateAppium(null), /объект/);
  assert.throws(() => validateAppium({ enabled: "true" }), /boolean/);
});

for (const format of ["stable", "v2"]) {
  test(`Appium and Maestro coexist through ${format} setup, reuse and independent disabling`, (t) => {
    const { root, env } = fixture(t);
    const foreign = { type: "local", command: ["unrelated"] };
    fs.writeFileSync(env.TESTDOCS_OPENCODE_CONFIG, JSON.stringify({
      mcp: format === "v2" ? { servers: { foreign } } : { foreign }, permission: { custom: "ask" }
    }));
    fs.writeFileSync(env.TESTDOCS_CODEX_CONFIG, '[mcp_servers.foreign]\ncommand = "unrelated"\n');
    fs.mkdirSync(env.TESTDOCS_DATA_DIR);
    const evidence = path.join(env.TESTDOCS_DATA_DIR, "keep.txt");
    fs.writeFileSync(evidence, "existing evidence");
    const answers = path.join(root, "answers.json");
    const command = fakeCli(root);
    fs.writeFileSync(answers, JSON.stringify({ version: 3, connections: {}, tms: { category: "none" },
      maestro: { command: fakeCli(root, "maestro") }, appium: { command } }));
    const run = (...args) => {
      const result = spawnSync(process.execPath, ["scripts/install.mjs", "--clients", "codex,opencode,claude,generic",
        "--opencode-format", format, "--skip-dependencies", "--no-cli", ...args], { cwd: repoRoot, env, encoding: "utf8", timeout: 30000 });
      assert.equal(result.status, 0, result.stdout + result.stderr);
    };
    for (const [args, appiumActive, maestroActive] of [
      [["--answers", answers], true, true],
      [["--reuse"], true, true],
      [["--reuse", "--appium-mode", "off"], false, true],
      [["--reuse"], false, true],
      [["--reuse", "--appium-mode", "on", "--maestro-mode", "off"], true, false]
    ]) {
      run(...args);
      const saved = JSON.parse(fs.readFileSync(env.TESTDOCS_CONFIG_FILE));
      assert.equal(saved.appium.enabled, appiumActive);
      assert.equal(saved.maestro.enabled, maestroActive);
      const oc = JSON.parse(fs.readFileSync(env.TESTDOCS_OPENCODE_CONFIG));
      const servers = format === "v2" ? oc.mcp.servers : oc.mcp;
      assert.deepEqual(servers.foreign, foreign);
      assert.equal(oc.permission.custom, "ask");
      const codex = fs.readFileSync(env.TESTDOCS_CODEX_CONFIG, "utf8");
      assert.match(codex, /\[mcp_servers.foreign\]/);
      for (const [name, active] of [["appium", appiumActive], ["maestro", maestroActive]]) {
        assert.equal(Boolean(servers[`testdocs_${name}`]), active);
        assert.equal((codex.match(new RegExp(`\\[mcp_servers.testdocs_${name}\\]`, "g")) || []).length, active ? 1 : 0);
      }
      if (appiumActive) {
        assert.match(codex, /"appium_session_management"/);
        assert.match(codex, /"appium_set_value"/);
        assert.doesNotMatch(codex, /"appium_prepare_ios_real_device"|"prepare_ios_simulator"|"appium_ai"/);
        assert.equal(servers.testdocs_appium.command.at(-1), "appium");
      }
      const generic = JSON.parse(fs.readFileSync(path.join(root, "private", "client-snippets", "generic-mcp.json")));
      assert.equal(Boolean(generic.mcpServers.testdocs_appium), appiumActive);
      const claude = fs.readFileSync(path.join(root, "private", "client-snippets", "claude-code.txt"), "utf8");
      assert.equal(claude.includes("testdocs_appium"), appiumActive);
      assert.equal(fs.readFileSync(evidence, "utf8"), "existing evidence");
    }
    run("--reuse", "--appium-mode", "auto", "--appium-command", path.join(root, "missing"));
    assert.equal(JSON.parse(fs.readFileSync(env.TESTDOCS_CONFIG_FILE)).appium.enabled, false);
    run("--reuse", "--appium-command", command);
    assert.equal(JSON.parse(fs.readFileSync(env.TESTDOCS_CONFIG_FILE)).appium.enabled, true);
  });
}

test("Appium launcher preserves stdio, SDK paths and external captures without MCP CLI arguments", (t) => {
  const { root, env } = fixture(t);
  const appium = resolveAppium({ command: fakeCli(root), javaHome: path.join(root, "jdk"), androidHome: path.join(root, "sdk") });
  fs.mkdirSync(path.dirname(env.TESTDOCS_CONFIG_FILE), { recursive: true });
  fs.writeFileSync(env.TESTDOCS_CONFIG_FILE, JSON.stringify({ appium }));
  const result = spawnSync(process.execPath, ["scripts/launch-mcp.mjs", "appium"], {
    cwd: repoRoot, env, input: '{"jsonrpc":"2.0","id":1}\n', encoding: "utf8", timeout: 10000
  });
  assert.equal(result.status, 0, result.stderr);
  const [metadata, wire] = result.stdout.trim().split("\n");
  const observed = JSON.parse(metadata);
  assert.deepEqual(observed.args, []);
  assert.equal(fs.realpathSync(observed.cwd), fs.realpathSync(env.TESTDOCS_DATA_DIR));
  assert.equal(observed.java, appium.javaHome);
  assert.equal(observed.android, appium.androidHome);
  assert.equal(observed.screenshots, path.join(env.TESTDOCS_DATA_DIR, "appium", "captures"));
  assert.equal(observed.vision, "false");
  assert.equal(wire, '{"jsonrpc":"2.0","id":1}');
  assert.equal(result.stderr, "fixture diagnostic\n");
  assert.throws(() => appiumLaunch({ ...appium, mode: "off" }), /выключен/);
  fs.rmSync(appium.command);
  assert.throws(() => appiumLaunch(appium), /не найден/);
});

test("Appium diagnostics do not start a session and optional CLI failure does not block installation checks", (t) => {
  const { root, env } = fixture(t);
  fs.mkdirSync(path.dirname(env.TESTDOCS_CONFIG_FILE), { recursive: true });
  const config = { appium: resolveAppium({ command: fakeCli(root) }) };
  fs.writeFileSync(env.TESTDOCS_CONFIG_FILE, JSON.stringify(config));
  const healthy = spawnSync(process.execPath, ["scripts/check-appium.mjs"], { cwd: repoRoot, env, encoding: "utf8", timeout: 10000 });
  assert.equal(healthy.status, 0, healthy.stderr);
  assert.match(healthy.stdout, /ещё не проверены/);
  const failedEnv = { ...env, TESTDOCS_FIXTURE_CLI_FAIL: "1" };
  const check = () => spawnSync(process.execPath, ["scripts/check-install.mjs"], { cwd: repoRoot, env: failedEnv, encoding: "utf8", timeout: 10000 });
  const optional = check();
  assert.equal(optional.status, 0, optional.stderr);
  assert.match(optional.stderr, /проверка остальных подключений продолжается/);
  config.appium.mode = "on";
  fs.writeFileSync(env.TESTDOCS_CONFIG_FILE, JSON.stringify(config));
  assert.equal(check().status, 1);
});

test("Appium Windows batch launcher quotes spaces and rejects command expansion", () => {
  assert.equal(appiumSpawnCommand("C:\\QA Tools\\appium-mcp.cmd", "win32"), '"C:\\QA Tools\\appium-mcp.cmd"');
  assert.throws(() => appiumSpawnCommand("C:\\%TEMP%\\appium-mcp.cmd", "win32"), /символы/);
  assert.equal(appiumSpawnCommand("/tmp/QA Tools/appium-mcp", "darwin"), "/tmp/QA Tools/appium-mcp");
});
