import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { repoRoot } from "./paths.mjs";
import { maestroLaunch, maestroSpawnCommand, resolveMaestro } from "./maestro-config.mjs";

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "testdocs-maestro-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const env = {
    ...process.env,
    TESTDOCS_INSTALL_ROOT: root,
    TESTDOCS_CONFIG_DIR: path.join(root, "private"),
    TESTDOCS_CONFIG_FILE: path.join(root, "private", "config.json"),
    TESTDOCS_DATA_DIR: path.join(root, "data"),
    TESTDOCS_CODEX_CONFIG: path.join(root, "codex.toml"),
    TESTDOCS_OPENCODE_CONFIG: path.join(root, "opencode.json")
  };
  return { root, env };
}

function fakeMaestro(root) {
  const command = path.join(root, "CLI with spaces", process.platform === "win32" ? "maestro.cmd" : "maestro");
  fs.mkdirSync(path.dirname(command), { recursive: true });
  const script = process.platform === "win32" ? `${command}.cjs` : command;
  fs.writeFileSync(script, `#!${process.execPath}
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === "mcp") {
  process.stdout.write(JSON.stringify({ args, cwd: process.cwd(), java: process.env.JAVA_HOME, android: process.env.ANDROID_HOME, path: process.env.PATH }) + "\\n");
  process.stderr.write("fixture diagnostic\\n");
  process.stdin.pipe(process.stdout);
} else if (args.join(" ") === "--version" || args.join(" ") === "--help") {
  process.stdout.write("maestro mcp\\n");
  process.exit(process.env.TESTDOCS_FIXTURE_CLI_FAIL === "1" ? 2 : 0);
} else process.exit(3);
`, { mode: 0o755 });
  if (process.platform === "win32") fs.writeFileSync(command, `@echo off\r\n"${process.execPath}" "${script}" %*\r\n`);
  return command;
}

test("auto detects CLI, absence is optional, on fails, off remains off", (t) => {
  const { root } = fixture(t);
  const env = { PATH: "", TESTDOCS_INSTALL_ROOT: root };
  assert.deepEqual(resolveMaestro({}, env, root), { mode: "auto", enabled: false });
  assert.throws(() => resolveMaestro({ mode: "on" }, env, root), /CLI не найден/);
  const command = fakeMaestro(root);
  const withPath = { ...env, PATH: path.dirname(command) };
  const detected = resolveMaestro({}, withPath, root);
  assert.equal(detected.enabled, true);
  assert.equal(detected.resolvedCommand, command);
  assert.equal(resolveMaestro({ mode: "off" }, withPath, root).enabled, false);
  assert.equal(resolveMaestro({ command: path.join(root, "missing") }, withPath, root).enabled, false);
  assert.throws(() => resolveMaestro({ command: "maestro --anything" }, env, root), /абсолютный путь/);
  assert.throws(() => resolveMaestro({ mode: "unknown" }, env, root), /режим/);
});

test("default installation directory works without a terminal PATH", (t) => {
  const { root } = fixture(t);
  const command = path.join(root, ".maestro", "bin", process.platform === "win32" ? "maestro.cmd" : "maestro");
  fs.mkdirSync(path.dirname(command), { recursive: true });
  fs.writeFileSync(command, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  const resolved = resolveMaestro({}, { PATH: "", TESTDOCS_INSTALL_ROOT: root }, root);
  assert.equal(resolved.resolvedCommand, command);
});

for (const format of ["stable", "v2"]) {
  test(`installer preserves ${format} client settings across auto, reuse and off`, (t) => {
    const { root, env } = fixture(t);
    const command = fakeMaestro(root);
    const foreign = { type: "local", command: ["unrelated"] };
    fs.writeFileSync(env.TESTDOCS_OPENCODE_CONFIG, JSON.stringify({
      mcp: format === "v2" ? { servers: { foreign } } : { foreign }, permission: { custom: "ask" }
    }));
    fs.writeFileSync(env.TESTDOCS_CODEX_CONFIG, '# user configuration\n[mcp_servers.foreign]\ncommand = "unrelated"\n');
    const answers = path.join(root, "answers.json");
    fs.writeFileSync(answers, JSON.stringify({ version: 3, connections: {}, tms: { category: "none" }, maestro: { command } }));
    const run = (...args) => {
      const result = spawnSync(process.execPath, ["scripts/install.mjs", "--clients", "codex,opencode,claude,generic",
        "--opencode-format", format, "--skip-dependencies", "--no-cli", ...args], { cwd: repoRoot, env, encoding: "utf8", timeout: 30000 });
      assert.equal(result.status, 0, result.stdout + result.stderr);
      return result;
    };
    for (const args of [["--answers", answers], ["--reuse"], ["--reuse", "--maestro-mode", "off"], ["--reuse"]]) {
      run(...args);
      const saved = JSON.parse(fs.readFileSync(env.TESTDOCS_CONFIG_FILE));
      const active = saved.maestro.mode !== "off";
      assert.equal(saved.maestro.enabled, active);
      assert.equal(saved.enableWrites, false);
      const oc = JSON.parse(fs.readFileSync(env.TESTDOCS_OPENCODE_CONFIG));
      const servers = format === "v2" ? oc.mcp.servers : oc.mcp;
      assert.deepEqual(servers.foreign, foreign);
      assert.equal(oc.permission.custom, "ask");
      assert.equal(Boolean(servers.testdocs_maestro), active);
      const codex = fs.readFileSync(env.TESTDOCS_CODEX_CONFIG, "utf8");
      assert.match(codex, /\[mcp_servers.foreign\]/);
      assert.equal((codex.match(/\[mcp_servers.testdocs_maestro\]/g) || []).length, active ? 1 : 0);
      if (active) {
        assert.match(codex, /default_tools_approval_mode = "writes"/);
        assert.match(codex, /"inspect_screen"/);
        assert.doesNotMatch(codex, /run_on_cloud/);
        assert.equal(servers.testdocs_maestro.command.at(-1), "maestro");
      }
      const generic = JSON.parse(fs.readFileSync(path.join(root, "private", "client-snippets", "generic-mcp.json")));
      assert.equal(Boolean(generic.mcpServers.testdocs_maestro), active);
    }
    // Installation without the SDK remains usable, then auto discovers it later.
    run("--reuse", "--maestro-mode", "auto", "--maestro-command", path.join(root, "missing"));
    assert.equal(JSON.parse(fs.readFileSync(env.TESTDOCS_CONFIG_FILE)).maestro.enabled, false);
    run("--reuse", "--maestro-command", command);
    assert.equal(JSON.parse(fs.readFileSync(env.TESTDOCS_CONFIG_FILE)).maestro.enabled, true);
  });
}

test("launcher preserves stdio and SDK paths and writes outside the repository", (t) => {
  const { root, env } = fixture(t);
  const maestro = resolveMaestro({ command: fakeMaestro(root), javaHome: path.join(root, "jdk"), androidHome: path.join(root, "sdk") });
  fs.mkdirSync(path.dirname(env.TESTDOCS_CONFIG_FILE), { recursive: true });
  fs.writeFileSync(env.TESTDOCS_CONFIG_FILE, JSON.stringify({ maestro, jira: { enabled: false } }));
  const result = spawnSync(process.execPath, ["scripts/launch-mcp.mjs", "maestro"], {
    cwd: repoRoot, env, input: '{"jsonrpc":"2.0","id":1}\n', encoding: "utf8", timeout: 10000
  });
  assert.equal(result.status, 0, result.stderr);
  const [metadata, wire] = result.stdout.trim().split("\n");
  const observed = JSON.parse(metadata);
  assert.deepEqual(observed.args, ["mcp"]);
  assert.equal(fs.realpathSync(observed.cwd), fs.realpathSync(env.TESTDOCS_DATA_DIR));
  assert.equal(observed.java, maestro.javaHome);
  assert.equal(observed.android, maestro.androidHome);
  assert.ok(observed.path.split(path.delimiter).includes(path.join(maestro.androidHome, "platform-tools")));
  assert.equal(wire, '{"jsonrpc":"2.0","id":1}');
  assert.equal(result.stderr, "fixture diagnostic\n");
  assert.throws(() => maestroLaunch({ ...maestro, mode: "off" }), /выключен/);
  fs.rmSync(maestro.command);
  assert.throws(() => maestroLaunch(maestro), /не найден/);
});

test("CLI diagnostic reports its boundary and catches startup failures", (t) => {
  const { root, env } = fixture(t);
  fs.mkdirSync(path.dirname(env.TESTDOCS_CONFIG_FILE), { recursive: true });
  fs.writeFileSync(env.TESTDOCS_CONFIG_FILE, JSON.stringify({ maestro: resolveMaestro({ command: fakeMaestro(root) }) }));
  const check = (fail) => spawnSync(process.execPath, ["scripts/check-maestro.mjs"], {
    cwd: repoRoot, env: { ...env, TESTDOCS_FIXTURE_CLI_FAIL: fail ? "1" : "0" }, encoding: "utf8", timeout: 10000
  });
  const healthy = check(false);
  assert.equal(healthy.status, 0);
  assert.match(healthy.stdout, /ещё не проверены/);
  assert.equal(check(true).status, 1);
  const installationCheck = () => spawnSync(process.execPath, ["scripts/check-install.mjs"], {
    cwd: repoRoot, env: { ...env, TESTDOCS_FIXTURE_CLI_FAIL: "1" }, encoding: "utf8", timeout: 10000
  });
  const optionalFailure = installationCheck();
  assert.equal(optionalFailure.status, 0);
  assert.match(optionalFailure.stderr, /проверка остальных подключений продолжается/);
  const saved = JSON.parse(fs.readFileSync(env.TESTDOCS_CONFIG_FILE));
  saved.maestro.mode = "on";
  fs.writeFileSync(env.TESTDOCS_CONFIG_FILE, JSON.stringify(saved));
  assert.equal(installationCheck().status, 1);
});

test("Windows batch paths are quoted and shell expansion characters rejected", () => {
  assert.equal(maestroSpawnCommand("C:\\QA Tools\\maestro.bat", "win32"), '"C:\\QA Tools\\maestro.bat"');
  assert.throws(() => maestroSpawnCommand("C:\\%TEMP%\\maestro.cmd", "win32"), /символы/);
  assert.equal(maestroSpawnCommand("/tmp/QA Tools/maestro", "darwin"), "/tmp/QA Tools/maestro");
});
