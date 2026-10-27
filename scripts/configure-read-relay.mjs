#!/usr/bin/env node
// Explicit local setup only. This is intentionally absent from the standard wizard.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import readline from "node:readline/promises";
import { pathToFileURL } from "node:url";
import { getConfigFile, getConfigDir } from "./paths.mjs";
import { migrateConfig, connectionList } from "./config-model.mjs";
import { acquireUpdateLock } from "./auto-update.mjs";
import { loadReadRelays, boundReadRelay, readRelaysFile, writePrivate } from "./read-relay-config.mjs";
import relay from "../mcp/read-relay.cjs";

async function ask(question) {
  const input = readline.createInterface({ input: process.stdin, output: process.stdout });
  try { return (await input.question(`${question}: `)).trim(); }
  finally { input.close(); }
}

async function askToken() {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) throw new Error("Для ключа откройте интерактивный терминал. Не передавайте ключ аргументом команды.");
  process.stdout.write("Ключ доступа (вставьте и нажмите Enter; ввод скрыт): ");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = () => { process.stdin.off("data", onData); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write("\n"); };
    const onData = (chunk) => {
      for (const char of chunk.replace(/\u001b\[(?:200|201)~/g, "")) {
        if (char === "\u0003") { finish(); reject(new Error("Настройка отменена.")); return; }
        if (char === "\r" || char === "\n") { finish(); resolve(value.trim()); return; }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else if (char >= " ") value += char;
      }
    };
    process.stdin.on("data", onData);
  });
}

export async function collectReadRelays(config, previous, { ask, askToken, saveToken }) {
  const result = structuredClone(previous);
  const choices = ["jira", "confluence"].flatMap((service) => connectionList(config, service).map((entry) => ({ service, entry })));
  if (!choices.length) throw new Error("Сначала настройте исходные подключения Jira/Confluence обычным способом.");
  const listing = choices.map(({ service, entry }, index) => `${index + 1} - ${service} ${entry.id} (${entry.url || entry.baseUrl})`).join("\n");
  const selected = (await ask(`Подключения для чтения через шлюз:\n${listing}\nНомера через запятую`)).split(",").map((item) => Number(item.trim()));
  if (!selected.length || selected.some((n) => !Number.isInteger(n) || n < 1 || n > choices.length) || new Set(selected).size !== selected.length) {
    throw new Error("Выберите существующие подключения без повторов.");
  }
  for (const number of selected) {
    const { service, entry } = choices[number - 1];
    if (entry.insecureTls) throw new Error("Сначала включите проверку TLS исходного подключения.");
    const url = relay.relayUrl(await ask(`Полный базовый адрес API чтения для ${service} ${entry.id}`));
    const binding = { sourceUrl: String(entry.url || entry.baseUrl).replace(/\/+$/, ""), url };
    if (service === "jira") {
      const keys = await ask(`Ключи проектов ${entry.id} через запятую (пусто - использовать полные ссылки задач)`);
      binding.projectKeys = keys ? keys.split(",").map((value) => value.trim().toUpperCase()) : [];
      if (binding.projectKeys.some((value) => !/^[A-Z][A-Z0-9_]*$/.test(value))) throw new Error("Неверный ключ проекта.");
    } else {
      const knowledge = await ask(`Полный адрес поиска знаний для ${entry.id} (пусто - без поиска по смыслу)`);
      if (knowledge) binding.knowledgeSearchUrl = relay.relayUrl(knowledge);
    }
    // Validate the full route before accepting or saving any credential.
    relay.validateRelay({ ...binding, tokenFile: path.join(getConfigDir(), "credentials", "placeholder") });
    result[service][entry.id] = binding;
  }
  const origins = new Set(selected.map((number) => {
    const { service, entry } = choices[number - 1];
    return new URL(result[service][entry.id].url).origin;
  }));
  if (origins.size !== 1) throw new Error("Один ключ можно привязать только к одному origin шлюза. Разные шлюзы настраивайте отдельными запусками.");
  const fallbackChoice = await ask("Резервное чтение той же системы без нового входа: 1 - сеть/таймаут/5xx (Enter); 0 - выключено");
  if (!["", "0", "1"].includes(fallbackChoice)) throw new Error("Выберите режим резервного чтения: 0 или 1.");
  const fallback = fallbackChoice === "0" ? "none" : "transient";
  const token = await askToken();
  if (!token || /\s/.test(token)) throw new Error("Нужен непустой ключ без пробельных символов.");
  const tokenFile = await saveToken(token);
  for (const number of selected) {
    const { service, entry } = choices[number - 1];
    result[service][entry.id].tokenFile = tokenFile;
    result[service][entry.id].fallback = fallback;
  }
  return result;
}

export async function main(args = process.argv.slice(2)) {
  if (args.some((arg) => !["--show", "--check"].includes(arg)) || args.length > 1) throw new Error("Использование: node scripts/configure-read-relay.mjs [--show|--check]. Ключ вводится только скрыто.");
  const config = migrateConfig(JSON.parse(fs.readFileSync(getConfigFile(), "utf8")));
  const settings = loadReadRelays();
  if (args.length) {
    let count = 0;
    for (const service of ["jira", "confluence"]) for (const entry of connectionList(config, service)) {
      const binding = boundReadRelay(settings, service, entry);
      if (!binding) continue;
      count += 1;
      console.log(`${service} ${entry.id}: чтение ${binding.url}; резерв ${binding.fallback || "none"}; ${service === "jira" ? "запись через исходное подключение" : "только чтение"}`);
      if (args[0] === "--check") {
        await relay.readRelay(binding, service === "jira" ? "/rest/api/2/myself" : "/rest/api/user/current");
        console.log("Чтение: доступ подтверждён. Запись не проверялась.");
      }
    }
    if (!count) console.log("Шлюзы чтения не настроены.");
    return;
  }
  const unlock = acquireUpdateLock();
  if (!unlock) throw new Error("Другая настройка или обновление уже выполняется.");
  let savedToken;
  try {
    const next = await collectReadRelays(config, settings, {
      ask, askToken,
      saveToken: (token) => {
        savedToken = path.join(getConfigDir(), "credentials", "read-relay", `${crypto.randomUUID()}.key`);
        writePrivate(savedToken, token);
        return savedToken;
      }
    });
    writePrivate(readRelaysFile(), `${JSON.stringify(next, null, 2)}\n`);
    savedToken = null;
    console.log("Настройки чтения сохранены отдельно. Исходные подключения и разрешения записи сохранены. Перезапустите MCP-серверы в клиенте.");
  } finally {
    if (savedToken) fs.rmSync(savedToken, { force: true });
    unlock();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const status = /^READ_RELAY_HTTP: (\d+)/.exec(error.message || "")?.[1];
    const reason = status ? `Шлюз вернул HTTP ${status}.` :
      /^READ_RELAY_(?:CONFIG|AUTH|NETWORK|PATH|RESPONSE):/.test(error.message || "") ? error.message.split("\n")[0] :
      error.code === "ENOENT" ? "Не найдены исходные настройки. Сначала настройте Jira/Confluence обычным способом." :
      "Проверьте введённые адреса, номера подключений и непустой ключ; для ввода ключа нужен интерактивный терминал.";
    console.error(`Настройка/проверка шлюза не завершена. ${reason}`);
    process.exitCode = 1;
  });
}
