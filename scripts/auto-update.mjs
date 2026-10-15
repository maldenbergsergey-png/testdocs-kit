#!/usr/bin/env node
// Installation maintenance only: no model calls, hooks, or MCP protocol output.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getConfigDir, getConfigFile, getInstallHome, getCodexConfigFile, getOpenCodeConfigFile, repoRoot } from "./paths.mjs";

export const DEFAULT_INTERVAL_HOURS = 4;
const internal = () => process.env.TESTDOCS_AUTO_UPDATE_INTERNAL === "1";
export const updateDirectory = () => path.join(getConfigDir(), "auto-update");
const settingsFile = () => path.join(updateDirectory(), "settings.json");
const stateFile = () => path.join(updateDirectory(), "state.json");
const read = (file, fallback = {}) => {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return fallback; throw error; }
};
export const readUpdateState = () => read(stateFile());
export const readUpdateSettings = () => read(settingsFile());
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temp, file);
}
function git(args, cwd = repoRoot) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", timeout: args[0] === "fetch" ? 120000 : 15000, windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never",
      GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND || "ssh -oBatchMode=yes -oConnectTimeout=10" } });
  // Git errors may include credential-bearing URLs. Keep them out of status and logs.
  if (result.error || result.status !== 0) throw new Error("Git недоступен или источник обновлений не ответил.");
  return result.stdout.trim();
}

export function acquireUpdateLock(root = updateDirectory()) {
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const lock = path.join(root, "lock");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = fs.openSync(lock, "wx", 0o600);
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid }));
      fs.closeSync(fd);
      return () => fs.rmSync(lock, { force: true });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      let owner;
      try { owner = JSON.parse(fs.readFileSync(lock, "utf8")); } catch { owner = {}; }
      const pid = typeof owner === "number" ? owner : owner.pid;
      const alive = (candidate) => {
        if (!Number.isInteger(candidate) || candidate <= 0) return false;
        try { process.kill(candidate, 0); return true; } catch (probe) { return probe.code !== "ESRCH"; }
      };
      if (alive(pid) || alive(owner?.childPid)) return null;
      try {
        if (!Number.isInteger(pid) || pid <= 0) {
          if (Date.now() - fs.statSync(lock).mtimeMs < 60000) return null;
        }
      }
      catch (probe) { if (probe.code !== "ESRCH") return null; }
      fs.rmSync(lock, { force: true });
    }
  }
  return null;
}

export function configureAutoUpdate({ enabled, intervalHours, sourceRoot = repoRoot } = {}) {
  if (internal()) return;
  const previous = readUpdateSettings();
  const interval = intervalHours ?? previous.intervalHours ?? DEFAULT_INTERVAL_HOURS;
  if (!Number.isFinite(interval) || interval < 0.25 || interval > 168) throw new Error("Интервал автообновления: от 0.25 до 168 часов.");
  const settings = { ...previous, enabled: enabled ?? previous.enabled ?? true, intervalHours: interval };
  let commit;
  try { commit = git(["rev-parse", "HEAD"], sourceRoot); } catch { /* Archive installations have no Git version. */ }
  if (!settings.enabled) settings.sourceRoot = sourceRoot;
  if (settings.enabled) {
    try {
      // An installed release keeps its original source; a manual setup may select a new upstream.
      const branch = git(["symbolic-ref", "--quiet", "--short", "HEAD"], sourceRoot);
      const remote = git(["config", `branch.${branch}.remote`], sourceRoot);
      const ref = git(["config", `branch.${branch}.merge`], sourceRoot);
      if (!/^refs\/heads\/.+/.test(ref) || remote === ".") throw new Error("Нет удалённой tracking-ветки.");
      const url = git(["remote", "get-url", remote], sourceRoot);
      settings.sourceRoot = sourceRoot;
      settings.remote = url;
      settings.ref = ref;
    } catch {
      if (!settings.remote || !settings.ref) {
        settings.enabled = false;
        console.warn("Автообновление не включено: нужна Git-ветка с настроенным upstream. Ручное обновление доступно.");
      }
    }
  }
  write(settingsFile(), settings);
  if (commit) write(stateFile(), { ...readUpdateState(), activeRoot: sourceRoot, commit, lastCheckedAt: Date.now(), status: "installed" });
  console.log(settings.enabled ? `Автообновление: проверка раз в ${interval} ч. при работающем MCP.` : "Автообновление отключено.");
}

export function activeRelease(fallback = repoRoot) {
  if (internal()) return fallback;
  try {
    if (readUpdateState().transaction) {
      const releaseLock = acquireUpdateLock();
      if (releaseLock) {
        try { recoverInterruptedUpdate(); } finally { releaseLock(); }
      }
    }
    const root = readUpdateState().activeRoot;
    // Only the registered source or one of our complete releases can be selected.
    const settings = readUpdateSettings();
    const releaseDirectory = path.join(updateDirectory(), "releases");
    const releases = `${fs.existsSync(releaseDirectory) ? fs.realpathSync(releaseDirectory) : releaseDirectory}${path.sep}`;
    if (root && (root === settings.sourceRoot || root.startsWith(releases)) &&
        fs.existsSync(path.join(root, "scripts", "launch-mcp.mjs"))) return fs.realpathSync(root);
  } catch { /* A damaged maintenance record must not prevent an existing MCP from starting. */ }
  return fallback;
}

export function previousSkillRoot() {
  try { return readUpdateState().activeRoot || readUpdateSettings().sourceRoot; } catch { return undefined; }
}

export function updateDue(settings, state, now = Date.now()) {
  return settings.enabled === true && typeof settings.sourceRoot === "string" && path.isAbsolute(settings.sourceRoot) &&
    typeof settings.remote === "string" && /^refs\/heads\/.+/.test(settings.ref || "") &&
    Number.isFinite(settings.intervalHours) && settings.intervalHours >= 0.25 && settings.intervalHours <= 168 &&
    (Boolean(state.transaction) || !Number.isFinite(state.lastCheckedAt) || now < state.lastCheckedAt || now - state.lastCheckedAt >= settings.intervalHours * 3600000);
}

export function startAutoUpdateChecks() {
  if (internal() || process.env.TESTDOCS_AUTO_UPDATE === "0") return;
  const check = () => {
    try {
      if (!updateDue(readUpdateSettings(), readUpdateState())) return;
      const child = spawn(process.execPath, [path.join(repoRoot, "scripts", "auto-update.mjs"), "--check"],
        { detached: true, stdio: "ignore", windowsHide: true, env: process.env });
      child.on("error", () => {});
      child.unref();
    } catch { /* Maintenance is never on the MCP startup path. */ }
  };
  check();
  const timer = setInterval(check, 60000);
  timer.unref();
}

// Run the candidate's installer without a terminal, with a bounded lifetime and a private log.
function install(root, args, env, log) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, "scripts", "install.mjs"), ...args],
      { cwd: root, env, detached: process.platform !== "win32", windowsHide: true, stdio: ["ignore", log, log] });
    const lock = path.join(updateDirectory(), "lock");
    // A surviving installer must finish before another worker can restore files.
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, childPid: child.pid }));
    const timer = setTimeout(() => {
      if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      else { try { process.kill(-child.pid, "SIGKILL"); } catch { /* Already exited. */ } }
    }, 15 * 60 * 1000);
    let spawnFailed = false;
    child.on("error", () => { spawnFailed = true; });
    child.on("close", (code) => {
      clearTimeout(timer);
      fs.writeFileSync(lock, JSON.stringify({ pid: process.pid }));
      code === 0 && !spawnFailed ? resolve() : reject(new Error("Установщик новой версии не прошёл проверку; см. update.log."));
    });
  });
}

function childEnvironment() {
  return { ...process.env, TESTDOCS_AUTO_UPDATE_INTERNAL: "1", TESTDOCS_AUTO_UPDATE: "0",
    TESTDOCS_ENABLE_JIRA_WRITES: "0", TESTDOCS_ENABLE_RELEASE_TEST_RUN_WRITES: "0",
    GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never", npm_config_audit: "false", npm_config_fund: "false" };
}
function hash(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }

function installationTargets(oldRoot, newRoot, config) {
  const targets = new Set([getConfigFile(), path.join(getConfigDir(), "client-snippets")]);
  const clients = config.clients || [];
  if (clients.includes("codex")) targets.add(getCodexConfigFile());
  if (clients.includes("opencode")) targets.add(getOpenCodeConfigFile());
  if (clients.includes("claude")) targets.add(path.join(getInstallHome(), ".claude.json"));
  // Config files may be linked to a dotfiles directory. Preserve both the link
  // and its contents when the installer writes through it.
  for (const target of [...targets]) {
    try { if (fs.lstatSync(target).isSymbolicLink()) targets.add(fs.realpathSync(target)); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const names = new Set([oldRoot, newRoot].filter(Boolean).flatMap((root) => fs.readdirSync(path.join(root, "skills"))));
  const dirs = [];
  if (clients.some((client) => ["codex", "opencode", "generic"].includes(client))) dirs.push(path.join(getInstallHome(), ".agents", "skills"));
  if (clients.includes("claude")) dirs.push(path.join(getInstallHome(), ".claude", "skills"));
  for (const dir of dirs) for (const name of names) targets.add(path.join(dir, name));
  return [...targets];
}
function snapshot(targets, backup) {
  fs.mkdirSync(backup, { recursive: true, mode: 0o700 });
  const records = targets.map((target, index) => {
    const stored = path.join(backup, String(index));
    let exists = true;
    try { fs.lstatSync(target); } catch (error) { if (error.code !== "ENOENT") throw error; exists = false; }
    if (exists) fs.cpSync(target, stored, { recursive: true, verbatimSymlinks: true });
    return { target, stored, exists };
  });
  write(path.join(backup, "manifest.json"), records);
  return records;
}
function restore(records) {
  for (const { target, stored, exists } of records) {
    fs.rmSync(target, { recursive: true, force: true });
    if (exists) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.cpSync(stored, target, { recursive: true, verbatimSymlinks: true });
    }
  }
}

export async function checkForUpdates({ force = false, prepare = install, activate = install } = {}) {
  const releaseLock = acquireUpdateLock();
  if (!releaseLock) return "busy";
  let log;
  let shadow;
  let candidate;
  try {
    recoverInterruptedUpdate();
    const settings = readUpdateSettings();
    const state = readUpdateState();
    if (!updateDue(settings, force ? {} : state)) return "skipped";
    const checked = { ...state, lastCheckedAt: Date.now() };
    write(stateFile(), checked); // Includes failures: offline machines don't retry on every launch.
    try {
      const output = git(["ls-remote", "--exit-code", settings.remote, settings.ref]);
      const commit = output.split(/\s+/)[0];
      if (!/^[a-f0-9]{40,64}$/.test(commit)) throw new Error("Источник вернул некорректную версию.");
      if (commit === state.commit) { write(stateFile(), { ...checked, status: "current" }); return "current"; }
      const releases = path.join(updateDirectory(), "releases");
      fs.mkdirSync(releases, { recursive: true, mode: 0o700 });
      const oldRoot = state.activeRoot || settings.sourceRoot;
      try { git(["diff", "--quiet", "HEAD", "--", "skills", "rules", "integrations", "scripts", "mcp", "package.json"], oldRoot); }
      catch { throw new Error("Установленные исходники изменены локально или недоступны; требуется ручное обновление."); }
      const root = path.join(fs.realpathSync(releases), `${commit}-${crypto.randomUUID()}`);
      candidate = root;
      // Never reuse a release directory: even an older release may still serve a live chat.
      fs.mkdirSync(root, { mode: 0o700 });
      git(["init", "--quiet"], root);
      git(["remote", "add", "origin", settings.remote], root);
      git(["fetch", "--quiet", "--depth=1", "origin", settings.ref], root);
      if (git(["rev-parse", "FETCH_HEAD"], root) !== commit) throw new Error("Ветка изменилась во время загрузки; повторим позже.");
      git(["checkout", "--quiet", "--detach", commit], root);
      for (const entry of ["scripts/install.mjs", "scripts/launch-mcp.mjs", "scripts/auto-update.mjs", "skills"]) {
        if (!fs.existsSync(path.join(root, entry))) throw new Error("Версия не поддерживает безопасное автообновление.");
      }
      const configHash = hash(getConfigFile());
      const config = read(getConfigFile());
      shadow = fs.mkdtempSync(path.join(updateDirectory(), ".prepare-"));
      const shadowConfig = path.join(shadow, "private", "config.json");
      write(shadowConfig, config);
      if (fs.existsSync(getOpenCodeConfigFile())) fs.copyFileSync(getOpenCodeConfigFile(), path.join(shadow, "opencode.json"));
      log = fs.openSync(path.join(updateDirectory(), "update.log"), "w", 0o600);
      const env = childEnvironment();
      await prepare(root, ["--reuse", "--no-cli", "--skip-browser-auth"], { ...env,
        TESTDOCS_INSTALL_ROOT: shadow, TESTDOCS_CONFIG_DIR: path.join(shadow, "private"), TESTDOCS_CONFIG_FILE: shadowConfig,
        TESTDOCS_DATA_DIR: path.join(shadow, "data"), TESTDOCS_CODEX_CONFIG: path.join(shadow, "codex", "config.toml"),
        TESTDOCS_OPENCODE_CONFIG: path.join(shadow, "opencode.json"),
        XDG_CONFIG_HOME: path.join(shadow, "config"), XDG_DATA_HOME: path.join(shadow, "data"),
        XDG_STATE_HOME: path.join(shadow, "state"), XDG_CACHE_HOME: path.join(shadow, "cache") }, log);
      if (hash(getConfigFile()) !== configHash) throw new Error("Настройки изменены во время подготовки; повторим позже.");
      const backup = path.join(updateDirectory(), "backups", `${Date.now()}-${process.pid}`);
      const records = snapshot(installationTargets(state.activeRoot || settings.sourceRoot, root, config), backup);
      // Persist rollback before any real client or skill files are touched (also covers process termination).
      write(stateFile(), { ...checked, transaction: { backup, previous: checked } });
      try {
        await activate(root, ["--reuse", "--activate-update", "--skip-browser-auth", "--no-cli"],
          { ...env, TESTDOCS_PREVIOUS_SKILL_ROOT: state.activeRoot || settings.sourceRoot }, log);
        write(stateFile(), { commit, activeRoot: root, previousRoot: state.activeRoot || settings.sourceRoot,
          lastCheckedAt: checked.lastCheckedAt, updatedAt: Date.now(), status: "updated", backup });
      } catch (error) { restore(records); write(stateFile(), checked); throw error; }
      return "updated";
    } catch (error) {
      const pending = readUpdateState().transaction;
      write(stateFile(), { ...checked, status: "failed", message: error.message, ...(pending ? { transaction: pending } : {}) });
      return "failed";
    }
  } finally {
    try {
      if (log !== undefined) fs.closeSync(log);
      if (shadow) fs.rmSync(shadow, { recursive: true, force: true });
      if (candidate && readUpdateState().activeRoot !== candidate && !readUpdateState().transaction) fs.rmSync(candidate, { recursive: true, force: true });
    } finally { releaseLock(); }
  }
}

export function recoverInterruptedUpdate() {
  const state = readUpdateState();
  if (!state.transaction) return;
  const records = read(path.join(state.transaction.backup, "manifest.json"));
  restore(records);
  write(stateFile(), { ...state.transaction.previous, status: "failed", message: "Прерванное обновление отменено." });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes("--status")) {
      const { remote, ...settings } = readUpdateSettings();
      console.log(JSON.stringify({ settings, state: readUpdateState() }, null, 2));
    } else if (process.argv.includes("--disable") || process.argv.includes("--enable") || process.argv.includes("--interval-hours")) {
      const releaseLock = acquireUpdateLock();
      if (!releaseLock) throw new Error("busy");
      try {
        const settings = readUpdateSettings();
        if (!settings.ref) throw new Error("Сначала выполните npm run update.");
        if (process.argv.includes("--enable") && process.argv.includes("--disable")) throw new Error("Выберите on или off.");
        if (process.argv.includes("--disable")) settings.enabled = false;
        if (process.argv.includes("--enable")) settings.enabled = true;
        const index = process.argv.indexOf("--interval-hours");
        if (index >= 0) {
          const hours = Number(process.argv[index + 1]);
          if (!Number.isFinite(hours) || hours < 0.25 || hours > 168) throw new Error("Неверный интервал.");
          settings.intervalHours = hours;
        }
        write(settingsFile(), settings);
        console.log(settings.enabled ? `Автообновление: раз в ${settings.intervalHours} ч.` : "Автообновление отключено.");
      } finally { releaseLock(); }
    } else if (process.argv.includes("--check")) {
      const result = await checkForUpdates({ force: process.argv.includes("--force") });
      console.log(result);
      if (result === "failed") process.exitCode = 1;
    } else throw new Error("Использование: auto-update.mjs --check [--force] | --status");
  } catch { process.stderr.write("Не удалось выполнить обслуживание обновлений.\n"); process.exitCode = 1; }
}
