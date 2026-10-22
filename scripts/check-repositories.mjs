#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { getConfigFile } from "./paths.mjs";
import { gitTransport, normalizeRepositories } from "./repository-config.mjs";
import { gitlabGet, sourceToken } from "./gitlab-read.mjs";

function runGit(args) {
  const result = spawnSync("git", args, {
    encoding: "utf8", timeout: 15000, maxBuffer: 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "Never" }
  });
  if (result.status !== 0 || result.error) throw new Error("Git-проверка не пройдена: проверьте доступ, SSH/credential helper и доверенный host key.");
  return result.stdout.trim();
}

export async function checkRepository(entry, { remote = false, git = runGit, http = fetch, env = process.env } = {}) {
  const result = { enabled: entry.enabled, transport: entry.transport || "git", readAccess: "not_checked", pushAccess: "not_checked" };
  if (!entry.enabled) return result;
  if (entry.transport === "gitlab_api") {
    try { sourceToken(entry, env); result.tokenAvailable = true; }
    catch { result.tokenAvailable = false; }
    if (!remote) return result;
    if (!result.tokenAvailable) throw new Error("GitLab PAT недоступен процессу агента.");
    const probeRef = entry.defaultRef || "HEAD";
    const fileProbe = Boolean(entry.project && entry.contractPath);
    const apiPath = fileProbe
      ? `/projects/${encodeURIComponent(entry.project)}/repository/files/${encodeURIComponent(entry.contractPath)}?ref=${encodeURIComponent(probeRef)}`
      : "/projects?membership=true&per_page=1&simple=true";
    const response = await gitlabGet(entry, apiPath, { method: fileProbe ? "HEAD" : "GET", http, env });
    await response.body?.cancel();
    result.readAccess = fileProbe ? "verified_for_probe_file" : "verified_for_projects_api";
    if (fileProbe) result.probeRef = probeRef;
    result.readOnlyScopesVerified = false;
    result.probeOnly = true;
    return result;
  }
  result.authentication = gitTransport(entry.url);
  if (entry.localPath) {
    const actualRoot = git(["-C", entry.localPath, "rev-parse", "--show-toplevel"]);
    if (fs.realpathSync(actualRoot) !== fs.realpathSync(entry.localPath)) throw new Error("Локальный путь не является корнем выбранного checkout.");
    const actualRemote = git(["-C", entry.localPath, "remote", "get-url", "origin"]);
    const comparable = value => value.replace(/\/+$/, "").replace(/\.git$/, "");
    result.remoteMatches = comparable(actualRemote) === comparable(entry.url);
    result.branch = git(["-C", entry.localPath, "branch", "--show-current"]) || "detached";
    result.hasLocalChanges = Boolean(git(["-C", entry.localPath, "status", "--porcelain", "--untracked-files=normal"]));
    if (entry.collectionPath) {
      const target = path.resolve(entry.localPath, entry.collectionPath);
      result.collectionExists = fs.existsSync(target);
      if (result.collectionExists) {
        const relative = path.relative(fs.realpathSync(entry.localPath), fs.realpathSync(target));
        if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error("Путь коллекции через symlink выходит из checkout.");
      }
    }
  }
  if (remote) {
    const output = git(["ls-remote", "--exit-code", entry.url, "HEAD"]);
    result.readAccess = /^[a-f\d]{40,64}\s+HEAD$/m.test(output) ? "verified_for_remote_head" : "remote_responded_without_head";
    result.probeOnly = true;
  }
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const allowed = new Set(["--show", "--remote", "--id"]);
  let id = "postman";
  for (let i = 0; i < args.length; i++) {
    if (!allowed.has(args[i])) throw new Error("Параметры: --show или --id postman|source-id [--remote].");
    if (args[i] === "--id") {
      id = args[++i];
      if (!id || id.startsWith("--")) throw new Error("После --id нужен ID привязки.");
    }
  }
  const configFile = getConfigFile();
  if (!fs.existsSync(configFile)) throw new Error("Настройки отсутствуют; выполните configure:repositories в установленной копии пакета.");
  let config;
  try { config = JSON.parse(fs.readFileSync(configFile, "utf8")); }
  catch { throw new Error("Не удалось прочитать JSON настроек; содержимое не выводилось."); }
  const repositories = normalizeRepositories(config.repositories || {});
  if (args.includes("--show")) {
    console.log(JSON.stringify(repositories, null, 2));
    return;
  }
  const entry = id === "postman" ? repositories.postman : repositories.sources.find(source => source.id === id);
  if (!entry) throw new Error("Привязка отсутствует; выполните configure:repositories.");
  const result = await checkRepository(entry, { remote: args.includes("--remote") });
  console.log(JSON.stringify({ id, ...result }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
