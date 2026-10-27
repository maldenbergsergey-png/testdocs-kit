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
import { loadReadRelays, boundReadRelay, readRelaysFile, writePrivate, issueRouting } from "./read-relay-config.mjs";
import relay from "../mcp/read-relay.cjs";
import issueResolver from "../mcp/issue-routing.cjs";

async function ask(question) {
  const input = readline.createInterface({ input: process.stdin, output: process.stdout });
  try { return (await input.question(`${question}: `)).trim(); }
  finally { input.close(); }
}

async function askToken(canReuse = false) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) throw new Error("Для ключа откройте интерактивный терминал. Не передавайте ключ аргументом команды.");
  process.stdout.write(canReuse ? "Вставьте новый ключ или нажмите Enter, чтобы сохранить прежний (ввод скрыт): " : "Вставьте ключ ассистента и нажмите Enter (ввод скрыт): ");
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

export async function collectReadRelays(config, previous, { ask, askToken, saveToken, log = () => {} }) {
  const result = structuredClone(previous);
  const choices = ["jira", "confluence"].flatMap((service) => connectionList(config, service).map((entry, index) => ({
    service, entry, label: service === "jira" ? `Jira ${index + 1}` : `Confluence ${index + 1}`
  })));
  if (!choices.length) throw new Error("Сначала настройте исходные подключения Jira/Confluence обычным способом.");
  const listing = choices.map(({ label, entry }, index) => `${index + 1}. ${label} - ${entry.url || entry.baseUrl}`).join("\n");
  const example = choices.slice(0, 3).map((_, index) => index + 1).join(",");
  const selected = (await ask(`Какие системы подключить к ассистенту?\n${listing}\nВведите номера через запятую, например ${example}`)).split(",").map((item) => Number(item.trim()));
  if (!selected.length || selected.some((n) => !Number.isInteger(n) || n < 1 || n > choices.length) || new Set(selected).size !== selected.length) {
    throw new Error("Выберите существующие подключения без повторов.");
  }
  for (const number of selected) {
    const { service, entry, label } = choices[number - 1];
    if (entry.insecureTls) throw new Error("Сначала включите проверку TLS исходного подключения.");
    const sourceUrl = String(entry.url || entry.baseUrl).replace(/\/+$/, "");
    const saved = previous[service][entry.id]?.sourceUrl === sourceUrl ? previous[service][entry.id] : null;
    let url;
    for (;;) {
      const input = await ask(`Вставьте ссылку ассистента для чтения ${label} (${sourceUrl}).\nВозьмите её из инструкции ассистента${saved?.url ? `; Enter - оставить ${saved.url}` : ""}\nСсылка`);
      try {
        url = relay.relayUrl(pastedUrl(input || saved?.url || ""));
        if (url === sourceUrl) throw new Error();
        break;
      } catch {
        log("Нужна ссылка на чтение через ассистента из его инструкции. Адрес самой Jira/Confluence сюда не подходит.");
      }
    }
    const binding = { sourceUrl, url };
    if (service === "jira") {
      binding.projectKeys = saved?.projectKeys || [];
    } else {
      const knowledge = await ask(`Есть отдельная ссылка ассистента для поиска документов по смыслу? Вставьте её${saved?.knowledgeSearchUrl ? `; Enter - оставить ${saved.knowledgeSearchUrl}; "нет" - отключить` : "; если нет, просто нажмите Enter"}`);
      const knowledgeUrl = /^(нет|no|0)$/i.test(knowledge) ? "" : knowledge || saved?.knowledgeSearchUrl;
      if (knowledgeUrl) binding.knowledgeSearchUrl = relay.relayUrl(pastedUrl(knowledgeUrl));
    }
    // Validate the full route before accepting or saving any credential.
    relay.validateRelay({ ...binding, tokenFile: path.join(getConfigDir(), "credentials", "placeholder") });
    result[service][entry.id] = binding;
  }
  const origins = new Set(selected.map((number) => {
    const { service, entry } = choices[number - 1];
    return new URL(result[service][entry.id].url).origin;
  }));
  if (origins.size !== 1) throw new Error("Один ключ подходит только для одного ассистента. Разных ассистентов подключайте отдельными запусками.");
  const fallbackChoice = (await ask("Если ассистент временно недоступен, попробовать обычное подключение к той же системе без нового входа? 1 - да; 0 - нет; Enter - сохранить прежний выбор, для нового подключения да")).toLowerCase();
  if (!["", "0", "1", "да", "нет", "yes", "no"].includes(fallbackChoice)) throw new Error("Ответьте да/нет или выберите 1/0.");
  const fallback = fallbackChoice ? ["0", "нет", "no"].includes(fallbackChoice) ? "none" : "transient" : null;
  const reusable = selected.map((number) => {
    const { service, entry } = choices[number - 1];
    const old = previous[service][entry.id];
    return old?.sourceUrl === result[service][entry.id].sourceUrl && new URL(old.url).origin === new URL(result[service][entry.id].url).origin ? old.tokenFile : null;
  });
  let reuseFile = reusable.every(Boolean) && new Set(reusable).size === 1 ? reusable[0] : null;
  try { if (reuseFile) relay.readToken(reuseFile); } catch { reuseFile = null; }
  let tokenFile;
  for (;;) {
    const token = await askToken(Boolean(reuseFile));
    if (!token && reuseFile) { tokenFile = reuseFile; break; }
    if (!token || /\s/.test(token)) { log("Ключ не распознан. Скопируйте только ключ из карточки ассистента и вставьте ещё раз."); continue; }
    tokenFile = await saveToken(token);
    break;
  }
  for (const number of selected) {
    const { service, entry } = choices[number - 1];
    result[service][entry.id].tokenFile = tokenFile;
    result[service][entry.id].fallback = fallback || previous[service][entry.id]?.fallback || (previous[service][entry.id] ? "none" : "transient");
  }
  return result;
}

function pastedUrl(input) {
  const value = String(input).trim();
  return /^\[[^\]\r\n]*\]\((https:\/\/[^\s)]+)\)$/.exec(value)?.[1] || value;
}

export async function main(args = process.argv.slice(2)) {
  const issueCheck = args[0] === "--check-issue" && args.length === 2;
  if (!issueCheck && (args.some((arg) => !["--show", "--check"].includes(arg)) || args.length > 1)) {
    throw new Error("Использование: node scripts/configure-read-relay.mjs [--show|--check|--check-issue <полная ссылка>]. Ключ вводится только скрыто.");
  }
  const config = migrateConfig(JSON.parse(fs.readFileSync(getConfigFile(), "utf8")));
  const settings = loadReadRelays();
  if (issueCheck) {
    const result = await probeIssue(config, settings, args[1]);
    console.log(JSON.stringify(result, null, 2));
    return;
  }
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
      ask, askToken, log: console.log,
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

export async function probeIssue(config, settings, reference, read = relay.readRelay) {
  reference = pastedUrl(reference);
  if (!/^https:\/\//i.test(reference)) throw new Error("READ_RELAY_CONFIG: для проверки нужна полная HTTPS-ссылка задачи.");
  const { connection, key } = issueResolver.resolveIssueReference(reference, issueRouting(config, settings));
  const original = connectionList(config, "jira").find((item) => item.id === connection.id);
  const binding = boundReadRelay(settings, "jira", original);
  if (!binding) throw new Error("READ_RELAY_CONFIG: для выбранной Jira шлюз чтения не настроен.");
  const issue = await read(binding, `/rest/api/${original.apiVersion || "2"}/issue/${encodeURIComponent(key)}`, { fields: "summary,status,description" });
  if (issue.key !== key || typeof issue.fields?.summary !== "string" || typeof issue.fields?.status?.name !== "string") {
    throw new Error("READ_RELAY_RESPONSE: ответ не подтвердил ключ, название и статус выбранной задачи.");
  }
  return { connectionId: connection.id, issueKey: issue.key, summary: issue.fields.summary, status: issue.fields.status.name,
    descriptionReceived: Object.hasOwn(issue.fields, "description"), readTransport: "read_relay", readUrl: binding.url, fallbackUsed: false };
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
