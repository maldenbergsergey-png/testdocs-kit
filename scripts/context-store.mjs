#!/usr/bin/env node
// Local immutable context files only. No model calls, external retrieval or execution claims.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDataDir } from "./paths.mjs";
import { workspaceSegment } from "./workspace-paths.mjs";

const scopeKeys = ["connection", "project", "feature", "scope"];
const identityKeys = [...scopeKeys, "task", "platform"];
const digest = (value) => crypto.createHash("sha256").update(value).digest("hex");
const kinds = ["requirements", "inventory", "analysis", "coverage"];
const completeness = ["COMPLETE", "PARTIAL", "UNAVAILABLE"];
const authorities = ["requirement", "decision", "observation", "practitioner"];

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}
function object(value, label, allowed) {
  ensure(value && typeof value === "object" && !Array.isArray(value), `${label}: ожидается объект.`);
  ensure(Object.keys(value).every((key) => allowed.includes(key)), `${label}: неизвестные поля.`);
}
function string(value, label, max = Infinity) {
  ensure(typeof value === "string" && value.trim() && value.length <= max, `${label}: требуется непустой текст допустимой длины.`);
  return value;
}
function identifier(value) {
  ensure(typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(value), "Некорректный ID источника или раздела.");
  return value;
}
function timestamp(value) {
  ensure(typeof value === "string" && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value)), "Некорректное время источника.");
  return value;
}
function unique(values, label) {
  ensure(new Set(values).size === values.length, `${label}: повторяющиеся значения.`);
  return values;
}
function identity(value, keys = identityKeys) {
  object(value, "Identity", keys);
  return Object.fromEntries(keys.map((key) => [key, string(value[key], key, 1024).trim().normalize("NFKC")]));
}
function source(value, current = false) {
  const fields = ["id", "ref", "revision", "fingerprint", "completeness", current ? "checkedAt" : "retrievedAt"];
  if (!current) fields.push("authority");
  object(value, "Source", fields);
  const ref = string(value.ref, "Source reference");
  if (/^https?:/i.test(ref)) {
    const url = new URL(ref);
    ensure(!url.username && !url.password && ![...url.searchParams.keys()].some((key) => /^(?:token|password|secret|access_token|api_key)$/i.test(key)), "Ссылка источника содержит учётные данные.");
  }
  ensure(value.revision === null || (typeof value.revision === "string" && value.revision.trim()), "Revision: требуется строка или null.");
  ensure(value.fingerprint === undefined || /^[a-f0-9]{64}$/.test(value.fingerprint), "Fingerprint: требуется SHA-256 полного исходного материала.");
  ensure(completeness.includes(value.completeness), "Некорректная полнота источника.");
  if (!current) ensure(authorities.includes(value.authority), "Некорректный тип доказательства источника.");
  return {
    id: identifier(value.id), ref, revision: value.revision,
    ...(value.fingerprint === undefined ? {} : { fingerprint: value.fingerprint }),
    completeness: value.completeness,
    ...(current ? { checkedAt: timestamp(value.checkedAt) } : { authority: value.authority, retrievedAt: timestamp(value.retrievedAt) })
  };
}
function sections(values, sources, platform, metadata = false) {
  ensure(Array.isArray(values) && values.length, "Требуется хотя бы один раздел.");
  const result = values.map((value) => {
    object(value, "Section", ["id", "title", "kind", "platforms", "sourceIds", metadata ? "sha256" : "content"]);
    ensure(kinds.includes(value.kind), "Некорректный тип раздела.");
    ensure(Array.isArray(value.platforms) && value.platforms.length, "Укажите применимость раздела к платформам.");
    const platforms = unique(value.platforms.map((item) => string(item, "Platform", 100)), "Platforms");
    ensure(!platforms.includes("shared"), "Shared - место хранения, а не целевая платформа.");
    ensure(platform === "shared" || platforms.includes(platform), "Раздел не относится к платформе снимка.");
    ensure(Array.isArray(value.sourceIds) && value.sourceIds.length, "Разделу нужны источники.");
    const sourceIds = unique(value.sourceIds.map(identifier), "Source IDs");
    for (const id of sourceIds) {
      const referenced = sources.find((item) => item.id === id);
      ensure(referenced, "Раздел ссылается на неизвестный источник.");
      if (value.kind === "requirements") ensure(["requirement", "decision"].includes(referenced.authority), "Наблюдение или старый checklist не является требованием.");
    }
    if (metadata) ensure(/^[a-f0-9]{64}$/.test(value.sha256), "Некорректный hash раздела.");
    return {
      id: identifier(value.id), title: string(value.title, "Section title", 300), kind: value.kind,
      platforms, sourceIds,
      ...(metadata ? { sha256: value.sha256 } : { content: string(value.content, "Section content") })
    };
  });
  unique(result.map((item) => item.id), "Sections");
  return result;
}
function basePath(value, dataRoot) {
  return path.join(dataRoot, "context", ...scopeKeys.map((key) => workspaceSegment(value[key], key)));
}
function taskPath(value, dataRoot) {
  return path.join(basePath(value, dataRoot), workspaceSegment(value.task, "task"), workspaceSegment(value.platform, "platform"));
}
function jsonFile(filename) {
  try { return JSON.parse(fs.readFileSync(filename, "utf8")); }
  catch { throw new Error("Не удалось прочитать JSON-файл контекста."); }
}
function privateFile(filename, content) {
  fs.writeFileSync(filename, content, { mode: 0o600, flag: "wx" });
}
function atomicJson(filename, value) {
  const temporary = `${filename}.${crypto.randomUUID()}.tmp`;
  try {
    privateFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
    fs.renameSync(temporary, filename);
  } finally { fs.rmSync(temporary, { force: true }); }
}
function manifestBase(value) {
  return { version: value.version, identity: value.identity, summary: value.summary, sources: value.sources, sections: value.sections };
}
function loadSnapshot(value, dataRoot, snapshotId) {
  const directory = taskPath(value, dataRoot);
  const pointer = snapshotId ? { snapshotId } : jsonFile(path.join(directory, "latest.json"));
  ensure(typeof pointer.snapshotId === "string" && /^[a-f0-9]{64}$/.test(pointer.snapshotId), "Повреждён указатель снимка.");
  const snapshotPath = path.join(directory, "snapshots", pointer.snapshotId);
  const manifest = jsonFile(path.join(snapshotPath, "manifest.json"));
  object(manifest, "Manifest", ["version", "identity", "summary", "sources", "sections", "snapshotId", "savedAt"]);
  ensure(manifest.version === 1, "Неподдерживаемая версия контекста.");
  const storedIdentity = identity(manifest.identity);
  ensure(identityKeys.every((key) => storedIdentity[key] === value[key]), "Identity снимка не совпадает с запросом.");
  string(manifest.summary, "Summary", 6000);
  ensure(Array.isArray(manifest.sources) && manifest.sources.length, "Нет источников снимка.");
  const sources = manifest.sources.map((item) => source(item));
  unique(sources.map((item) => item.id), "Sources");
  sections(manifest.sections, sources, storedIdentity.platform, true);
  timestamp(manifest.savedAt);
  ensure(manifest.snapshotId === pointer.snapshotId && digest(JSON.stringify(manifestBase(manifest))) === pointer.snapshotId, "Нарушена целостность метаданных снимка.");
  return { manifest, snapshotPath };
}
function indexEntry(manifest) {
  return { ...manifest, reuseStatus: "UNVERIFIED" };
}

export function saveSnapshot(input, dataRoot = getDataDir()) {
  object(input, "Snapshot", ["version", "identity", "summary", "sources", "sections"]);
  ensure(input.version === 1, "Неподдерживаемая версия контекста.");
  const key = identity(input.identity);
  const summary = string(input.summary, "Summary", 6000);
  ensure(Array.isArray(input.sources) && input.sources.length, "Требуются источники.");
  const sources = input.sources.map((item) => source(item));
  unique(sources.map((item) => item.id), "Sources");
  const parts = sections(input.sections, sources, key.platform);
  const metadata = parts.map(({ content, ...item }) => ({ ...item, sha256: digest(content) }));
  const base = { version: 1, identity: key, summary, sources, sections: metadata };
  const snapshotId = digest(JSON.stringify(base));
  const snapshotsRoot = path.join(taskPath(key, dataRoot), "snapshots");
  fs.mkdirSync(snapshotsRoot, { recursive: true, mode: 0o700 });
  const destination = path.join(snapshotsRoot, snapshotId);
  if (!fs.existsSync(destination)) {
    const staging = fs.mkdtempSync(path.join(snapshotsRoot, ".staging-"));
    try {
      privateFile(path.join(staging, "manifest.json"), `${JSON.stringify({ ...base, snapshotId, savedAt: new Date().toISOString() }, null, 2)}\n`);
      for (const part of parts) privateFile(path.join(staging, `${part.id}.md`), part.content);
      try { fs.renameSync(staging, destination); }
      catch (error) { if (!["EEXIST", "ENOTEMPTY"].includes(error.code)) throw error; }
    } finally { fs.rmSync(staging, { recursive: true, force: true }); }
  }
  const { manifest, snapshotPath } = loadSnapshot(key, dataRoot, snapshotId);
  for (const part of manifest.sections) ensure(digest(fs.readFileSync(path.join(snapshotPath, `${part.id}.md`))) === part.sha256, "Нарушена целостность содержимого раздела.");
  atomicJson(path.join(taskPath(key, dataRoot), "latest.json"), { snapshotId });
  return { ...indexEntry(manifest), path: snapshotPath };
}

export function listSnapshots(input, dataRoot = getDataDir()) {
  const key = identity(Object.fromEntries(scopeKeys.map((name) => [name, input[name]])), scopeKeys);
  const directory = basePath(key, dataRoot);
  if (!fs.existsSync(directory)) return { snapshots: [] };
  const snapshots = [];
  for (const task of fs.readdirSync(directory, { withFileTypes: true }).filter((item) => item.isDirectory())) {
    const taskDirectory = path.join(directory, task.name);
    for (const platform of fs.readdirSync(taskDirectory, { withFileTypes: true }).filter((item) => item.isDirectory())) {
      const platformDirectory = path.join(taskDirectory, platform.name);
      const pointerFile = path.join(platformDirectory, "latest.json");
      if (!fs.existsSync(pointerFile)) continue;
      const pointer = jsonFile(pointerFile);
      ensure(typeof pointer.snapshotId === "string" && /^[a-f0-9]{64}$/.test(pointer.snapshotId), "Повреждён указатель снимка.");
      const raw = jsonFile(path.join(platformDirectory, "snapshots", pointer.snapshotId, "manifest.json"));
      if ((input.task && raw.identity?.task !== input.task) || (input.platform && raw.identity?.platform !== input.platform)) continue;
      const candidate = identity(raw.identity);
      ensure(scopeKeys.every((name) => candidate[name] === key[name]) && task.name === workspaceSegment(candidate.task, "task") && platform.name === workspaceSegment(candidate.platform, "platform"), "Повреждён индекс контекста.");
      snapshots.push(indexEntry(loadSnapshot(candidate, dataRoot).manifest));
    }
  }
  return { snapshots: snapshots.sort((a, b) => a.identity.task.localeCompare(b.identity.task) || a.identity.platform.localeCompare(b.identity.platform)) };
}

function checkSource(saved, current) {
  if (!current) return "UNVERIFIED";
  if (Date.parse(current.checkedAt) < Date.parse(saved.retrievedAt)) return "UNVERIFIED";
  if (saved.ref !== current.ref) return "CHANGED";
  if (current.completeness === "UNAVAILABLE") return "UNAVAILABLE";
  if (saved.completeness !== "COMPLETE" || current.completeness !== "COMPLETE") return "PARTIAL";
  const revisionsComparable = saved.revision !== null && current.revision !== null;
  const fingerprintsComparable = saved.fingerprint !== undefined && current.fingerprint !== undefined;
  if ((revisionsComparable && saved.revision !== current.revision) || (fingerprintsComparable && saved.fingerprint !== current.fingerprint)) return "CHANGED";
  return revisionsComparable || fingerprintsComparable ? "CURRENT" : "UNVERIFIED";
}

export function checkSnapshot(input, { currentSources, sectionIds, targetPlatform } = {}, dataRoot = getDataDir()) {
  const key = identity(input);
  const { manifest } = loadSnapshot(key, dataRoot);
  const target = targetPlatform || (key.platform === "shared" ? undefined : key.platform);
  string(target, "Target platform", 100);
  ensure(target !== "shared", "Укажите настоящую целевую платформу.");
  let checked = [];
  if (currentSources !== undefined) {
    object(currentSources, "Current sources", ["identity", "sources"]);
    const currentKey = identity(currentSources.identity, scopeKeys);
    ensure(scopeKeys.every((name) => currentKey[name] === key[name]), "Проверка источников относится к другому scope.");
    ensure(Array.isArray(currentSources.sources), "Требуется список проверенных источников.");
    checked = currentSources.sources.map((item) => source(item, true));
    unique(checked.map((item) => item.id), "Current sources");
  }
  if (sectionIds !== undefined) {
    ensure(Array.isArray(sectionIds) && sectionIds.length, "Выберите хотя бы один раздел.");
    unique(sectionIds.map(identifier), "Selected sections");
    ensure(sectionIds.every((id) => manifest.sections.some((item) => item.id === id)), "Выбран неизвестный раздел.");
  }
  const selected = sectionIds ? manifest.sections.filter((item) => sectionIds.includes(item.id)) : manifest.sections;
  const usedSourceIds = new Set(selected.flatMap((item) => item.sourceIds));
  const sources = manifest.sources.filter((item) => usedSourceIds.has(item.id)).map((item) => ({
    ...item, status: checkSource(item, checked.find((candidate) => candidate.id === item.id))
  }));
  const result = selected.map((item) => {
    const checks = item.sourceIds.map((id) => sources.find((candidate) => candidate.id === id).status);
    const status = !item.platforms.includes(target) ? "NOT_APPLICABLE" : checks.every((check) => check === "CURRENT") ? "CURRENT" : "REFRESH_REQUIRED";
    return { ...item, status };
  });
  const reusable = result.filter((item) => item.status === "CURRENT").length;
  return {
    snapshotId: manifest.snapshotId, identity: manifest.identity, targetPlatform: target,
    status: reusable === result.length ? "CURRENT" : reusable ? "PARTIAL_REUSE" : "REFRESH_REQUIRED",
    sources, sections: result
  };
}

export function readSections(input, options, dataRoot = getDataDir()) {
  ensure(Array.isArray(options?.sectionIds) && options.sectionIds.length, "Read требует явного выбора разделов.");
  const result = checkSnapshot(input, options, dataRoot);
  const { snapshotPath } = loadSnapshot(identity(input), dataRoot, result.snapshotId);
  result.sections = result.sections.map((item) => {
    if (item.status !== "CURRENT") return item;
    const content = fs.readFileSync(path.join(snapshotPath, `${item.id}.md`), "utf8");
    ensure(digest(content) === item.sha256, "Нарушена целостность содержимого раздела.");
    return { ...item, content };
  });
  return result;
}

function cli(argv) {
  const [command, ...args] = argv;
  const flags = {};
  const sectionIds = [];
  const allowed = [...identityKeys, "file", "current-sources", "section", "target-platform"];
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index]?.slice(2);
    ensure(args[index]?.startsWith("--") && allowed.includes(name) && args[index + 1] && !args[index + 1].startsWith("--"), "Некорректные аргументы context-store.");
    if (name === "section") sectionIds.push(args[index + 1]);
    else { ensure(flags[name] === undefined, "Повторяющийся аргумент context-store."); flags[name] = args[index + 1]; }
  }
  ensure(["save", "list", "check", "read"].includes(command), "Использование: context-store.mjs save --file <json> | list|check|read --connection <id> --project <id> --feature <id> --scope <id> [--task <id> --platform <name>] [--section <id>] [--target-platform <name>] [--current-sources <json>]");
  const permitted = command === "save" ? ["file"] : command === "list" ? identityKeys : [...identityKeys, "current-sources", "target-platform"];
  ensure(Object.keys(flags).every((name) => permitted.includes(name)) && (!["save", "list"].includes(command) || sectionIds.length === 0), "Аргумент не поддерживается этой командой.");
  if (command === "save") { string(flags.file, "File"); return saveSnapshot(jsonFile(flags.file)); }
  if (command === "list") return listSnapshots(flags);
  const key = Object.fromEntries(identityKeys.map((name) => [name, flags[name]]));
  const options = {
    ...(sectionIds.length ? { sectionIds } : {}),
    targetPlatform: flags["target-platform"],
    ...(flags["current-sources"] ? { currentSources: jsonFile(flags["current-sources"]) } : {})
  };
  return command === "read" ? readSections(key, options) : checkSnapshot(key, options);
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(`${JSON.stringify(cli(process.argv.slice(2)), null, 2)}\n`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
