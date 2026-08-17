#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { getConfigDir, getConfigFile, getSessionFile } from "./paths.mjs";

const currentFile = fileURLToPath(import.meta.url);
const require = createRequire(import.meta.url);
const { getCookieHeader } = require("../mcp/session-auth.cjs");
const service = process.argv[2];
const force = process.argv.includes("--force");
const supportedServices = new Set(["jira", "confluence"]);

function fail(message) {
  console.error(`Testdocs Kit: ${message}`);
  process.exit(1);
}

function readConfig() {
  const configFile = getConfigFile();
  if (!fs.existsSync(configFile)) fail(`не найден ${configFile}. Выполните npm run setup.`);
  return JSON.parse(fs.readFileSync(configFile, "utf8"));
}

function respawnForRuntime(config) {
  if (typeof WebSocket === "undefined" && process.env.TESTDOCS_WEBSOCKET_READY !== "1") {
    const result = spawnSync(process.execPath, ["--experimental-websocket", currentFile, ...process.argv.slice(2)], {
      stdio: "inherit",
      env: { ...process.env, TESTDOCS_WEBSOCKET_READY: "1" }
    });
    process.exit(result.status ?? 1);
  }
  if (config.caFile && process.env.NODE_EXTRA_CA_CERTS !== config.caFile && process.env.TESTDOCS_AUTH_CA_READY !== "1") {
    const result = spawnSync(process.execPath, [currentFile, ...process.argv.slice(2)], {
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_EXTRA_CA_CERTS: config.caFile,
        TESTDOCS_AUTH_CA_READY: "1"
      }
    });
    process.exit(result.status ?? 1);
  }
}

function configuredService(config) {
  const entry = config[service];
  if (!entry?.enabled) fail(`${service} отключён в настройках.`);
  if (entry.authMode !== "browser_session") {
    fail(`${service} использует режим ${entry.authMode || "не определён"}, а не вход через браузер.`);
  }
  const baseUrl = (service === "jira" ? entry.url : entry.baseUrl)?.replace(/\/+$/, "");
  if (!baseUrl) fail(`не заполнен адрес ${service}.`);
  return { entry, baseUrl };
}

function commandPath(command) {
  const result = spawnSync(process.platform === "win32" ? "where" : "which", [command], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  });
  return result.status === 0 ? result.stdout.split(/\r?\n/)[0].trim() : null;
}

function findBrowser() {
  const supplied = process.env.TESTDOCS_BROWSER;
  if (supplied && fs.existsSync(supplied)) return supplied;

  const candidates = process.platform === "darwin"
    ? [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/Applications/Chromium.app/Contents/MacOS/Chromium"
      ]
    : process.platform === "win32"
      ? [
          path.join(process.env.PROGRAMFILES || "", "Google", "Chrome", "Application", "chrome.exe"),
          path.join(process.env["PROGRAMFILES(X86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
          path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe")
        ]
      : ["google-chrome", "google-chrome-stable", "microsoft-edge", "chromium", "chromium-browser"];

  for (const candidate of candidates) {
    if (path.isAbsolute(candidate) && fs.existsSync(candidate)) return candidate;
    const resolved = commandPath(candidate);
    if (resolved) return resolved;
  }
  fail("не найден Google Chrome, Microsoft Edge или Chromium. Установите один из них либо задайте TESTDOCS_BROWSER=/полный/путь.");
}

function cookieHeaderFromCookies(cookies, baseUrl) {
  const temporary = path.join(os.tmpdir(), `testdocs-session-probe-${process.pid}-${service}.json`);
  try {
    fs.writeFileSync(temporary, JSON.stringify({ version: 1, service, baseUrl, cookies }), { mode: 0o600 });
    return getCookieHeader(temporary, `${baseUrl}/`, service);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function cookiesForService(cookies, baseUrl) {
  const hostname = new URL(baseUrl).hostname.toLowerCase();
  return cookies.filter((cookie) => {
    const domain = String(cookie.domain || "").replace(/^\./, "").toLowerCase();
    return domain && (hostname === domain || hostname.endsWith(`.${domain}`));
  });
}

async function probe(baseUrl, cookies) {
  let cookieHeader;
  try {
    cookieHeader = cookieHeaderFromCookies(cookies, baseUrl);
  } catch {
    return false;
  }
  const probePath = service === "jira" ? "/rest/api/2/myself" : "/rest/api/user/current";
  let response;
  try {
    response = await fetch(`${baseUrl}${probePath}`, {
      redirect: "manual",
      headers: { Cookie: cookieHeader, Accept: "application/json" }
    });
  } catch {
    return false;
  }
  if (!response.ok) return false;
  try {
    const data = await response.json();
    if (service === "jira") return Boolean(data.name || data.key || data.accountId || data.displayName);
    return data.type !== "anonymous" && Boolean(data.username || data.userKey || data.displayName);
  } catch {
    return false;
  }
}

function readStoredCookies(sessionFile, baseUrl) {
  if (!fs.existsSync(sessionFile)) return [];
  try {
    const stored = JSON.parse(fs.readFileSync(sessionFile, "utf8"));
    return stored.baseUrl === baseUrl && Array.isArray(stored.cookies) ? stored.cookies : [];
  } catch {
    return [];
  }
}

function saveSession(sessionFile, baseUrl, cookies) {
  fs.mkdirSync(path.dirname(sessionFile), { recursive: true, mode: 0o700 });
  const temporary = `${sessionFile}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify({
    version: 1,
    service,
    baseUrl,
    authenticatedAt: new Date().toISOString(),
    cookies
  }, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, sessionFile);
  try { fs.chmodSync(sessionFile, 0o600); } catch { /* Windows uses ACLs. */ }
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function readDevToolsPort(file, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(file)) {
      const [port, browserPath] = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
      if (port && browserPath) return `ws://127.0.0.1:${port}${browserPath}`;
    }
    await wait(200);
  }
  throw new Error("браузер не открыл порт авторизации за 20 секунд.");
}

class CdpClient {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.socket = new WebSocket(url);
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", () => reject(new Error("не удалось подключиться к окну браузера.")), { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(typeof event.data === "string" ? event.data : Buffer.from(event.data).toString("utf8"));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result || {});
    });
    this.socket.addEventListener("close", () => {
      for (const pending of this.pending.values()) {
        pending.reject(new Error("окно браузера было закрыто до завершения авторизации."));
      }
      this.pending.clear();
    }, { once: true });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function authenticate(baseUrl, sessionFile) {
  const browser = findBrowser();
  const profileDir = path.join(getConfigDir(), "browser-profiles", service);
  const portFile = path.join(profileDir, "DevToolsActivePort");
  fs.mkdirSync(profileDir, { recursive: true, mode: 0o700 });
  fs.rmSync(portFile, { force: true });

  const child = spawn(browser, [
    `--user-data-dir=${profileDir}`,
    "--remote-debugging-port=0",
    "--remote-allow-origins=*",
    "--no-first-run",
    "--no-default-browser-check",
    "--new-window",
    baseUrl
  ], { detached: false, stdio: "ignore" });

  let cdp;
  try {
    const webSocketUrl = await readDevToolsPort(portFile);
    cdp = new CdpClient(webSocketUrl);
    await cdp.connect();
    console.log(`Открыт отдельный профиль браузера Testdocs Kit для ${baseUrl}.`);
    console.log("Завершите вход, включая SSO или двухфакторную проверку. Ожидание — до 10 минут.");

    const deadline = Date.now() + 10 * 60 * 1000;
    while (Date.now() < deadline) {
      const { cookies = [] } = await cdp.send("Storage.getCookies");
      const serviceCookies = cookiesForService(cookies, baseUrl);
      if (await probe(baseUrl, serviceCookies)) {
        saveSession(sessionFile, baseUrl, serviceCookies);
        console.log(`Сессия ${service} сохранена: ${sessionFile}`);
        await cdp.send("Browser.close").catch(() => {});
        return;
      }
      await wait(2000);
    }
    throw new Error("время ожидания входа истекло.");
  } finally {
    cdp?.close();
    if (!child.killed) child.kill("SIGTERM");
  }
}

async function main() {
  if (!supportedServices.has(service)) {
    fail("укажите сервис: npm run auth -- jira или npm run auth -- confluence");
  }
  const config = readConfig();
  respawnForRuntime(config);
  if (typeof WebSocket === "undefined") {
    fail("для браузерной авторизации требуется Node.js 20.10+ или актуальная LTS-версия.");
  }
  const { baseUrl } = configuredService(config);
  const sessionFile = getSessionFile(service);
  const storedCookies = readStoredCookies(sessionFile, baseUrl);
  if (!force && storedCookies.length && await probe(baseUrl, storedCookies)) {
    console.log(`Сессия ${service} действует. Повторный вход не требуется.`);
    return;
  }
  await authenticate(baseUrl, sessionFile);
}

main().catch((error) => fail(error.message));
