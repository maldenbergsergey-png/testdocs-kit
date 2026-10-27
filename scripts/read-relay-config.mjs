import fs from "node:fs";
import path from "node:path";
import { getConfigDir } from "./paths.mjs";
import relay from "../mcp/read-relay.cjs";

export const readRelaysFile = () => process.env.TESTDOCS_READ_RELAYS_FILE || path.join(getConfigDir(), "read-relays.json");

export function loadReadRelays() {
  let config;
  try { config = JSON.parse(fs.readFileSync(readRelaysFile(), "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return { version: 1, jira: {}, confluence: {} };
    throw new Error("READ_RELAY_CONFIG: не удалось прочитать отдельные настройки шлюза.");
  }
  if (!config || config.version !== 1 || ["jira", "confluence"].some((service) =>
    !config[service] || typeof config[service] !== "object" || Array.isArray(config[service]))) {
    throw new Error("READ_RELAY_CONFIG: неверная версия или структура настроек шлюза.");
  }
  for (const service of ["jira", "confluence"]) for (const [id, binding] of Object.entries(config[service])) {
    if (!/^[a-z0-9-]+$/.test(id) || !binding || typeof binding.sourceUrl !== "string" ||
        (binding.projectKeys !== undefined && (!Array.isArray(binding.projectKeys) ||
          binding.projectKeys.some((key) => typeof key !== "string" || !/^[A-Z][A-Z0-9_]*$/.test(key))))) {
      throw new Error("READ_RELAY_CONFIG: неверная привязка исходного подключения.");
    }
    relay.validateRelay(binding);
  }
  return config;
}

export function boundReadRelay(settings, service, connection) {
  const binding = settings[service]?.[connection.id];
  if (!binding) return null;
  if (connection.insecureTls) throw new Error("READ_RELAY_CONFIG: сначала включите проверку TLS исходного подключения.");
  const source = service === "jira" ? connection.url : connection.baseUrl;
  if (binding.sourceUrl !== String(source).replace(/\/+$/, "")) {
    throw new Error("READ_RELAY_CONFIG: адрес исходного подключения изменился. Повторите отдельную настройку шлюза.");
  }
  return relay.validateRelay(binding);
}

export function issueRouting(config, settings) {
  return (config.connections?.jira || []).filter((item) => item.enabled !== false).map((item) => ({
    id: item.id, url: item.url,
    projectKeys: settings.jira?.[item.id]?.sourceUrl === String(item.url).replace(/\/+$/, "")
      ? settings.jira[item.id].projectKeys || [] : []
  }));
}

export function writePrivate(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, contents, { mode: 0o600, flag: "wx" });
    fs.renameSync(temporary, file);
  } finally { fs.rmSync(temporary, { force: true }); }
}
