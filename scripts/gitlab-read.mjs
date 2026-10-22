#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getConfigFile, repoRoot } from "./paths.mjs";
import { normalizeRepositories } from "./repository-config.mjs";

export function sourceToken(entry, env = process.env) {
  const value = env[entry.tokenEnv];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (entry.tokenFile) {
    try {
      const token = fs.readFileSync(entry.tokenFile, "utf8").trim();
      if (token) return token;
    } catch { throw new Error("Приватный файл GitLab PAT недоступен; повторите настройку источника."); }
  }
  throw new Error("GitLab PAT недоступен; настройте приватный токен или переменную окружения процесса агента.");
}

export async function gitlabGet(entry, apiPath, { method = "GET", http = fetch, env = process.env } = {}) {
  if (!entry.enabled || entry.transport !== "gitlab_api") throw new Error("Нужен включённый GitLab REST источник.");
  if (!["GET", "HEAD"].includes(method)) throw new Error("Источник GitLab разрешает только GET и HEAD.");
  const allowed = /^\/projects(?:\?|$|\/[^/?]+(?:\?|$|\/(?:repository\/|merge_requests(?:\/|\?|$))))/;
  if (!allowed.test(apiPath)) {
    throw new Error("Разрешено чтение проектов, repository и merge_requests в scope задачи.");
  }
  const token = sourceToken(entry, env);
  const url = new URL(`${entry.url}/api/v4${apiPath}`);
  const expected = new URL(`${entry.url}/api/v4/`);
  if (url.origin !== expected.origin || !url.pathname.startsWith(expected.pathname) || !allowed.test(url.pathname.slice(expected.pathname.length - 1) + url.search) || url.hash || [...url.searchParams.keys()].some(key => /token|authorization|password/i.test(key))) {
    throw new Error("Некорректный путь GitLab API.");
  }
  let response;
  try {
    response = await http(url.href, {
      method, headers: { "PRIVATE-TOKEN": token }, redirect: "error", signal: AbortSignal.timeout(15000)
    });
  } catch { throw new Error("GitLab REST недоступен: проверьте сеть/VPN и доверенные CA. Токен не выводился."); }
  if (!response.ok) throw new Error(`GitLab REST: HTTP ${response.status}; проверьте права, срок и read scope токена, project/ref/путь.`);
  return response;
}

async function main() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!["--source", "--api-path", "--output"].includes(args[i]) || !args[i + 1]) throw new Error("Параметры: --source ID --api-path '/projects/…' --output /absolute/task/file.");
    options[args[i]] = args[i + 1];
  }
  if (!options["--source"] || !options["--api-path"] || !path.isAbsolute(options["--output"] || "")) throw new Error("Нужны источник, API path и абсолютный output.");
  const destination = path.resolve(options["--output"]);
  // Outputs belong to the task, never to this portable skill pack.
  const parent = fs.realpathSync(path.dirname(destination));
  const relative = path.relative(fs.realpathSync(repoRoot), parent);
  if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) throw new Error("Сохраните результат вне переносимого QA pack.");
  let config;
  try { config = JSON.parse(fs.readFileSync(getConfigFile(), "utf8")); }
  catch { throw new Error("Настройте источник через configure:repository-sources."); }
  const entry = normalizeRepositories(config.repositories || {}).sources.find(source => source.id === options["--source"]);
  if (!entry) throw new Error("Источник GitLab не найден.");
  // Exclusive creation prevents overwriting a task file or following an output symlink.
  const response = await gitlabGet(entry, options["--api-path"]);
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 10 * 1024 * 1024) throw new Error("Ответ превышает 10 MiB; сузьте запрос.");
    chunks.push(chunk);
  }
  fs.writeFileSync(destination, Buffer.concat(chunks), { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ status: response.status, bytes: size, output: destination }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
