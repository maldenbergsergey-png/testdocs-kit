import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { repoRoot } from "./paths.mjs";
import { acquireUpdateLock, activeRelease, checkForUpdates, readUpdateSettings, readUpdateState,
  updateDirectory, updateDue } from "./auto-update.mjs";

function command(cmd, args, cwd, env = process.env) {
  const result = spawnSync(cmd, args, { cwd, env, encoding: "utf8", timeout: 30000 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout.trim();
}
const git = (cwd, ...args) => command("git", args, cwd);
function put(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
function json(file, data) { put(file, JSON.stringify(data)); }
function fixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "testdocs auto update ")));
  const env = { TESTDOCS_INSTALL_ROOT: root, TESTDOCS_CONFIG_DIR: path.join(root, "private"),
    TESTDOCS_CONFIG_FILE: path.join(root, "private", "config.json"), TESTDOCS_CODEX_CONFIG: path.join(root, "codex.toml"),
    TESTDOCS_OPENCODE_CONFIG: path.join(root, "opencode.json"), TESTDOCS_DATA_DIR: path.join(root, "data"), TESTDOCS_AUTO_UPDATE: "0" };
  const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value;
    fs.rmSync(root, { recursive: true, force: true });
  });
  const remote = path.join(root, "remote");
  fs.mkdirSync(remote);
  git(remote, "init", "--quiet", "-b", "main");
  git(remote, "config", "user.name", "Fixture");
  git(remote, "config", "user.email", "fixture@example.invalid");
  // Use the actual installer, launcher and contracts; dependencies are unnecessary
  // for a skills/remote-MCP-only installation. No network or deployed paths are used.
  for (const name of ["scripts", "mcp", "rules", "integrations", "examples", "docs", "evals"]) {
    fs.cpSync(path.join(repoRoot, name), path.join(remote, name), { recursive: true,
      filter: (source) => !["node_modules", "dist", "__pycache__"].includes(path.basename(source)) });
  }
  for (const name of ["package.json", "README.md", "AGENTS.md"]) fs.copyFileSync(path.join(repoRoot, name), path.join(remote, name));
  put(path.join(remote, "skills", "demo", "SKILL.md"), "v1\n[contract](../../rules/core.md)\n");
  put(path.join(remote, "skills", "retired", "SKILL.md"), "retired\n");
  const commit = () => { git(remote, "add", "."); git(remote, "commit", "--quiet", "-m", "Fixture release"); return git(remote, "rev-parse", "HEAD"); };
  const initial = commit();
  const source = path.join(root, "tester checkout");
  git(root, "clone", "--quiet", remote, source);
  const settings = path.join(updateDirectory(), "settings.json");
  const state = path.join(updateDirectory(), "state.json");
  json(settings, { enabled: true, intervalHours: 4, sourceRoot: source, remote, ref: "refs/heads/main" });
  json(state, { activeRoot: source, commit: initial, lastCheckedAt: 0 });
  const answers = path.join(root, "answers.json");
  json(answers, { version: 3, connections: { mcp: [{ id: "gitlab-1", enabled: true, kind: "remote", provider: "gitlab",
    url: "https://gitlab.example.invalid/api/v4/mcp", authMode: "oauth" }] },
    tms: { category: "none", provider: "none" }, maestro: { mode: "off" }, figma: { mode: "off" },
    browser: { enabled: false, mode: "persistent" }, privateMarker: "preserve-private-value" });
  put(env.TESTDOCS_CODEX_CONFIG, '# unrelated user setting\nmodel = "user-model"\n');
  if (process.platform !== "win32") {
    const physical = path.join(root, "dotfiles", "codex.toml");
    fs.mkdirSync(path.dirname(physical));
    fs.renameSync(env.TESTDOCS_CODEX_CONFIG, physical);
    fs.symlinkSync(physical, env.TESTDOCS_CODEX_CONFIG);
  }
  json(env.TESTDOCS_OPENCODE_CONFIG, { mcp: { foreign: { type: "local", command: ["unrelated"] } }, permission: { custom: "ask" } });
  json(path.join(root, ".claude.json"), { userSetting: true, mcpServers: { foreign: { type: "stdio", command: "unrelated" } } });
  command(process.execPath, [path.join(source, "scripts", "install.mjs"), "--clients", "codex,claude,opencode,generic",
    "--answers", answers, "--skip-dependencies", "--skip-browser-auth", "--no-cli"], source);
  // Leave the first automatic check due after the initial installation.
  json(state, { ...readUpdateState(), lastCheckedAt: 0 });
  return { root, env, remote, source, initial, commit, settings, state };
}

test("cooldown, disabled state and clock changes do not require a model", () => {
  const settings = { enabled: true, intervalHours: 4, sourceRoot: repoRoot, remote: "fixture", ref: "refs/heads/main" };
  assert.equal(updateDue(settings, { lastCheckedAt: 1000 }, 1001), false);
  assert.equal(updateDue(settings, { lastCheckedAt: 1000 }, 14401000), true);
  assert.equal(updateDue(settings, { lastCheckedAt: 1000 }, 0), true);
  assert.equal(updateDue({ ...settings, enabled: false }, {}, 1000), false);
  assert.equal(updateDue({ ...settings, intervalHours: 0 }, {}, 1000), false);
});

test("unchanged upstream skips preparation; cooldown skips remote access; checks serialize", async (t) => {
  const f = fixture(t);
  const never = () => { throw new Error("An unchanged version must not invoke the installer"); };
  assert.equal(await checkForUpdates({ prepare: never, activate: never }), "current");
  assert.equal(fs.existsSync(path.join(updateDirectory(), "releases")), false);
  fs.renameSync(f.remote, `${f.remote}-offline`);
  assert.equal(await checkForUpdates({ prepare: never }), "skipped");
  const release = acquireUpdateLock();
  assert(release);
  assert.equal(await checkForUpdates({ force: true }), "busy");
  release();
  const dead = spawnSync(process.execPath, ["-e", "" ]);
  json(path.join(updateDirectory(), "lock"), { pid: dead.pid, childPid: process.pid });
  assert.equal(acquireUpdateLock(), null, "An orphaned installer must finish before recovery");
  json(path.join(updateDirectory(), "lock"), { pid: dead.pid });
  const recovered = acquireUpdateLock();
  assert(recovered, "A dead worker's lock is recoverable");
  recovered();
  assert.equal(await checkForUpdates({ force: true }), "failed");
  assert.equal(readUpdateState().activeRoot, f.source);
  assert.equal(await checkForUpdates(), "skipped", "Offline errors also observe cooldown");
});

test("full release activates with real installer, preserves user data and source checkout, and retires owned skills", async (t) => {
  const f = fixture(t);
  put(path.join(f.source, "local-note.txt"), "tester-local-file");
  put(path.join(f.root, "data", "projects", "task", "evidence.txt"), "evidence");
  put(path.join(f.root, "private", "sessions", "jira.json"), "session");
  put(path.join(f.remote, "skills", "demo", "SKILL.md"), "v2\n[contract](../../rules/core.md)\n");
  put(path.join(f.remote, "skills", "new-skill", "SKILL.md"), "new skill\n");
  fs.rmSync(path.join(f.remote, "skills", "retired"), { recursive: true });
  put(path.join(f.remote, "mcp", "changed-component.txt"), "new MCP component");
  const nextCommit = f.commit();
  assert.equal(await checkForUpdates(), "updated");
  const state = readUpdateState();
  assert.equal(state.commit, nextCommit);
  assert.notEqual(state.activeRoot, f.source);
  assert.equal(activeRelease(), state.activeRoot);
  assert.equal(fs.readFileSync(path.join(state.activeRoot, "mcp", "changed-component.txt"), "utf8"), "new MCP component");
  assert.match(fs.readFileSync(path.join(f.root, ".agents", "skills", "demo", "SKILL.md"), "utf8"), /^v2/);
  assert(fs.existsSync(path.join(f.root, ".agents", "skills", "new-skill", "SKILL.md")));
  assert.equal(fs.existsSync(path.join(f.root, ".agents", "skills", "retired")), false);
  assert.equal(git(f.source, "rev-parse", "HEAD"), f.initial);
  assert.equal(fs.readFileSync(path.join(f.source, "local-note.txt"), "utf8"), "tester-local-file");
  assert.equal(fs.readFileSync(path.join(f.root, "data", "projects", "task", "evidence.txt"), "utf8"), "evidence");
  assert.equal(fs.readFileSync(path.join(f.root, "private", "sessions", "jira.json"), "utf8"), "session");
  const config = JSON.parse(fs.readFileSync(f.env.TESTDOCS_CONFIG_FILE));
  assert.equal(config.privateMarker, "preserve-private-value");
  assert(fs.readFileSync(f.env.TESTDOCS_CODEX_CONFIG, "utf8").includes('model = "user-model"'));
  if (process.platform !== "win32") assert(fs.lstatSync(f.env.TESTDOCS_CODEX_CONFIG).isSymbolicLink());
  const openCode = JSON.parse(fs.readFileSync(f.env.TESTDOCS_OPENCODE_CONFIG));
  assert.equal(openCode.permission.custom, "ask");
  assert.deepEqual(openCode.mcp.foreign.command, ["unrelated"]);
  const claude = JSON.parse(fs.readFileSync(path.join(f.root, ".claude.json")));
  assert.equal(claude.userSetting, true);
  assert.equal(claude.mcpServers.foreign.command, "unrelated");
  assert.equal(claude.mcpServers.testdocs_gitlab_1.type, "http");
  assert.equal(await checkForUpdates({ force: true }), "current");
  assert.equal(readUpdateSettings().sourceRoot, f.source);
  const disabled = command(process.execPath, [path.join(state.activeRoot, "scripts", "auto-update.mjs"), "--disable"], f.root);
  assert.match(disabled, /отключено/);
  assert.equal(activeRelease(), state.activeRoot, "Disabling checks must not roll back the installed version");
  assert.equal(await checkForUpdates({ force: true }), "skipped");
});

test("failed preparation and activation preserve installed files; interrupted transactions recover", async (t) => {
  const f = fixture(t);
  const beforeConfig = fs.readFileSync(f.env.TESTDOCS_CONFIG_FILE, "utf8");
  const beforeCodex = fs.readFileSync(f.env.TESTDOCS_CODEX_CONFIG, "utf8");
  const beforeSkill = fs.readlinkSync(path.join(f.root, ".agents", "skills", "demo"));
  put(path.join(f.remote, "skills", "demo", "SKILL.md"), "v2\n");
  f.commit();
  const sourceSkill = path.join(f.source, "skills", "demo", "SKILL.md");
  const originalSkill = fs.readFileSync(sourceSkill, "utf8");
  fs.appendFileSync(sourceSkill, "tester-local-edit");
  let prepared = false;
  assert.equal(await checkForUpdates({ prepare: async () => { prepared = true; } }), "failed");
  assert.equal(prepared, false);
  assert.match(fs.readFileSync(sourceSkill, "utf8"), /tester-local-edit/);
  put(sourceSkill, originalSkill);
  assert.equal(await checkForUpdates({ force: true, prepare: async () => { throw new Error("dependency install failed"); } }), "failed");
  assert.equal(fs.readFileSync(f.env.TESTDOCS_CONFIG_FILE, "utf8"), beforeConfig);
  let interrupted;
  assert.equal(await checkForUpdates({ force: true, prepare: async () => {}, activate: async () => {
    interrupted = readUpdateState();
    put(f.env.TESTDOCS_CONFIG_FILE, "broken config");
    put(f.env.TESTDOCS_CODEX_CONFIG, "broken client");
    throw new Error("activation failed");
  } }), "failed");
  assert.equal(fs.readFileSync(f.env.TESTDOCS_CONFIG_FILE, "utf8"), beforeConfig);
  assert.equal(fs.readFileSync(f.env.TESTDOCS_CODEX_CONFIG, "utf8"), beforeCodex);
  if (process.platform !== "win32") assert(fs.lstatSync(f.env.TESTDOCS_CODEX_CONFIG).isSymbolicLink());
  assert.equal(fs.readlinkSync(path.join(f.root, ".agents", "skills", "demo")), beforeSkill);
  put(f.env.TESTDOCS_CODEX_CONFIG, "partial write left by a terminated process");
  json(f.state, interrupted);
  assert.equal(activeRelease(), f.source, "A launcher recovers before reading a partially written private config");
  assert.equal(fs.readFileSync(f.env.TESTDOCS_CODEX_CONFIG, "utf8"), beforeCodex);
  assert.equal(readUpdateState().transaction, undefined);
  assert.equal(readUpdateState().activeRoot, f.source);
});

test("edited skills and invalid client config stop automatic activation without overwriting them", async (t) => {
  const f = fixture(t);
  const installed = path.join(f.root, ".agents", "skills", "demo");
  fs.rmSync(installed);
  put(path.join(installed, "SKILL.md"), "local custom skill");
  put(path.join(f.remote, "skills", "demo", "SKILL.md"), "v2\n");
  f.commit();
  assert.equal(await checkForUpdates(), "failed");
  assert.equal(fs.readFileSync(path.join(installed, "SKILL.md"), "utf8"), "local custom skill");
  assert.equal(readUpdateState().activeRoot, f.source);
  put(f.env.TESTDOCS_OPENCODE_CONFIG, '{ // user JSONC\n "mcp": {}\n}');
  assert.equal(await checkForUpdates({ force: true }), "failed");
  assert.match(fs.readFileSync(f.env.TESTDOCS_OPENCODE_CONFIG, "utf8"), /user JSONC/);
});

test("MCP launcher updates in the background, preserves the live server, and routes the next launch without protocol noise", { skip: process.platform === "win32" }, async (t) => {
  const f = fixture(t);
  const fake = path.join(f.root, "fixture-maestro.mjs");
  put(fake, `#!${process.execPath}\nprocess.stdin.setEncoding("utf8");\nprocess.stdin.on("data", input => process.stdout.write(JSON.stringify({ version: process.env.TESTDOCS_FIXTURE_RELEASE || "v1", input: input.trim() }) + "\\n"));\n`);
  fs.chmodSync(fake, 0o755);
  const config = JSON.parse(fs.readFileSync(f.env.TESTDOCS_CONFIG_FILE));
  config.maestro = { mode: "on", enabled: true, command: fake, resolvedCommand: fake };
  json(f.env.TESTDOCS_CONFIG_FILE, config);
  const launcher = path.join(f.remote, "scripts", "launch-mcp.mjs");
  put(launcher, fs.readFileSync(launcher, "utf8").replace("const config = readConfig();", 'process.env.TESTDOCS_FIXTURE_RELEASE = "v2";\nconst config = readConfig();'));
  f.commit();
  const child = spawn(process.execPath, [path.join(f.source, "scripts", "launch-mcp.mjs"), "maestro"],
    { env: { ...process.env, TESTDOCS_AUTO_UPDATE: "1" }, stdio: ["pipe", "pipe", "pipe"] });
  t.after(() => child.kill());
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const until = async (condition) => {
    const deadline = Date.now() + 20000;
    while (!condition()) {
      assert(Date.now() < deadline, `Timed out: ${JSON.stringify(readUpdateState())}; ${stderr}`);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };
  child.stdin.write("before\n");
  await until(() => stdout.includes("before"));
  assert.equal(JSON.parse(stdout.trim()).version, "v1");
  await until(() => readUpdateState().status === "updated" && !fs.existsSync(path.join(updateDirectory(), "lock")));
  child.stdin.write("after\n");
  await until(() => stdout.includes("after"));
  assert.deepEqual(stdout.trim().split("\n").map(JSON.parse).map((row) => row.version), ["v1", "v1"]);
  const next = spawnSync(process.execPath, [path.join(f.source, "scripts", "launch-mcp.mjs"), "maestro"], {
    env: { ...process.env, TESTDOCS_AUTO_UPDATE: "0" }, encoding: "utf8", input: "next\n", timeout: 10000
  });
  assert.equal(next.status, 0, next.stderr);
  assert.deepEqual(JSON.parse(next.stdout.trim()), { version: "v2", input: "next" });
  const ended = new Promise((resolve) => child.on("close", resolve));
  child.stdin.end();
  await ended;
});
