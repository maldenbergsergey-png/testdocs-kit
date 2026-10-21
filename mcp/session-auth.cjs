const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { fetchWithSpSecret, withHttpDiagnostics } = require("./atlassian-http.cjs");

function createAuthRequiredError(service, reason, sessionFile) {
  const key = sessionFile ? path.basename(sessionFile, ".json") : service;
  const id = key.startsWith(`${service}-`) ? key.slice(service.length + 1) : "";
  const connection = /^[a-z0-9-]+$/.test(id) ? ` ${id}` : "";
  const error = new Error(
    `AUTH_REQUIRED: ${reason} Откройте Terminal в каталоге testdocs-kit и выполните: npm run auth -- ${service}${connection}`
  );
  error.code = "AUTH_REQUIRED";
  return error;
}

function domainMatches(hostname, cookieDomain) {
  const normalized = String(cookieDomain || "").replace(/^\./, "").toLowerCase();
  const host = hostname.toLowerCase();
  return Boolean(normalized) && (host === normalized || host.endsWith(`.${normalized}`));
}

function pathMatches(pathname, cookiePath) {
  const normalized = cookiePath || "/";
  if (normalized === "/") return true;
  return pathname === normalized ||
    (pathname.startsWith(normalized) && (normalized.endsWith("/") || pathname[normalized.length] === "/"));
}

function validateSession(session, requestUrl, service, sessionFile) {
  const target = new URL(requestUrl);
  let storedUrl;
  try { storedUrl = new URL(session.baseUrl); }
  catch { throw createAuthRequiredError(service, "Некорректный адрес сохранённой сессии.", sessionFile); }
  const storedPath = storedUrl.pathname.replace(/\/$/, "") || "/";
  if (session.service !== service || target.origin !== storedUrl.origin || !pathMatches(target.pathname, storedPath)) {
    throw createAuthRequiredError(service, "Сессия создана для другого адреса сервиса.", sessionFile);
  }
}

function readSession(sessionFile, requestUrl, service, contents) {
  if (!sessionFile || !fs.existsSync(sessionFile)) {
    throw createAuthRequiredError(service, "Сохранённая браузерная сессия не найдена.", sessionFile);
  }

  let session;
  try {
    session = JSON.parse(contents ?? fs.readFileSync(sessionFile, "utf8"));
  } catch {
    throw createAuthRequiredError(service, "Не удалось прочитать браузерную сессию.", sessionFile);
  }

  validateSession(session, requestUrl, service, sessionFile);
  return session;
}

function cookieHeader(session, requestUrl) {
  const target = new URL(requestUrl);

  const now = Date.now() / 1000;
  const cookies = (Array.isArray(session.cookies) ? session.cookies : []).filter((cookie) => {
    if (!cookie?.name || typeof cookie.value !== "string") return false;
    if (!domainMatches(target.hostname, cookie.domain)) return false;
    if (cookie.hostOnly && target.hostname !== cookie.domain) return false;
    if (!pathMatches(target.pathname, cookie.path)) return false;
    if (cookie.secure && target.protocol !== "https:") return false;
    if (Number(cookie.expires) > 0 && Number(cookie.expires) <= now) return false;
    return true;
  });

  // More specific paths must precede the same cookie name at a broader path.
  cookies.sort((a, b) => (b.path || "/").length - (a.path || "/").length);
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

function getCookieHeader(sessionFile, requestUrl, service) {
  const session = readSession(sessionFile, requestUrl, service);
  if (session.authRequired) {
    throw createAuthRequiredError(service, "Сессия требует повторного входа; запросы остановлены.", sessionFile);
  }
  const header = cookieHeader(session, requestUrl);
  if (!header) {
    throw createAuthRequiredError(service, "В сохранённой сессии нет действующих cookies для сервиса.", sessionFile);
  }
  return header;
}

function saveSession(sessionFile, session) {
  fs.mkdirSync(path.dirname(sessionFile), { recursive: true, mode: 0o700 });
  const temporary = `${sessionFile}.tmp-${randomUUID()}`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(session, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    fs.renameSync(temporary, sessionFile);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

// RFC 6265 sections 5.2/5.3. The containing session still enforces the exact
// configured origin and service path, even for cookies with a parent Domain.
function cookiesFromResponse(session, requestUrl, response) {
  const target = new URL(requestUrl);
  const cookies = [...(Array.isArray(session.cookies) ? session.cookies : [])];
  const now = Date.now() / 1000;
  for (const header of response.headers.getSetCookie?.() || []) {
    const [pair, ...attributes] = header.split(";");
    const separator = pair.indexOf("=");
    if (separator < 1) continue;
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (!/^[!#$%&'*+.^_`|~\w-]+$/.test(name) || /[\x00-\x20\x7f;,]/.test(value)) continue;
    const cookie = { name, value, domain: target.hostname, hostOnly: true,
      path: target.pathname.slice(0, target.pathname.lastIndexOf("/")) || "/", expires: -1 };
    let maxAge;
    for (const attribute of attributes) {
      const index = attribute.indexOf("=");
      const key = (index < 0 ? attribute : attribute.slice(0, index)).trim().toLowerCase();
      const val = index < 0 ? "" : attribute.slice(index + 1).trim();
      if (key === "domain" && val) { cookie.domain = val.replace(/^\./, "").toLowerCase(); cookie.hostOnly = false; }
      if (key === "path" && val.startsWith("/")) cookie.path = val;
      if (key === "secure") cookie.secure = true;
      if (key === "httponly") cookie.httpOnly = true;
      if (key === "expires" && Number.isFinite(Date.parse(val))) cookie.expires = Date.parse(val) / 1000;
      if (key === "max-age" && /^-?\d+$/.test(val) && Number.isFinite(Number(val))) maxAge = Number(val);
    }
    if (!domainMatches(target.hostname, cookie.domain)) continue;
    if (cookie.secure && target.protocol !== "https:") continue;
    if (maxAge !== undefined) cookie.expires = maxAge <= 0 ? 0 : now + maxAge;
    const existing = cookies.findIndex((item) => item.name === name &&
      String(item.domain).replace(/^\./, "").toLowerCase() === cookie.domain && (item.path || "/") === cookie.path);
    if (existing >= 0) cookies.splice(existing, 1);
    if (cookie.expires === -1 || cookie.expires > now) cookies.push(cookie);
  }
  return cookies;
}

async function lockSession(sessionFile) {
  const directory = `${sessionFile}.locks`;
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const name = `${process.pid}-${randomUUID()}.json`;
  const claim = path.join(directory, name);
  const release = () => fs.rmSync(claim, { force: true });
  const deadline = Date.now() + 30000;

  function peers() {
    const result = [];
    for (const file of fs.readdirSync(directory)) {
      const match = /^(\d+)-[a-f0-9-]+\.json$/.exec(file);
      if (!match) continue;
      const pid = Number(match[1]);
      const peer = path.join(directory, file);
      try {
        process.kill(pid, 0);
      } catch (error) {
        // Each claim has a unique filename. Reaping a crashed process cannot
        // delete a new owner's lock while other MCP processes are acquiring it.
        if (error.code === "ESRCH") { fs.rmSync(peer, { force: true }); continue; }
        if (error.code !== "EPERM") throw error;
      }
      try { result.push({ name: file, ...JSON.parse(fs.readFileSync(peer, "utf8")) }); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    return result;
  }

  // Bakery mutual exclusion: publish intent, choose a ticket, then wait for
  // earlier tickets (UUID order breaks ties). No platform-specific lock API.
  saveSession(claim, { choosing: true, ticket: 0 });
  try {
    const ticket = 1 + Math.max(0, ...peers().map((peer) => peer.ticket));
    saveSession(claim, { choosing: false, ticket });
    while (true) {
      const waiting = peers().some((peer) => peer.name !== name &&
        (peer.choosing || peer.ticket < ticket || (peer.ticket === ticket && peer.name < name)));
      if (!waiting) return release;
      if (Date.now() >= deadline) throw new Error("SESSION_BUSY: предыдущий запрос с этой сессией ещё не завершён. Повторный вход не требуется.");
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  } catch (error) {
    release();
    throw error;
  }
}

async function fetchWithSession(url, options, { service, sessionFile, baseUrl, spSecret, bootstrapAuthorization }) {
  if (!sessionFile) throw createAuthRequiredError(service, "Не задан файл сессии.");
  const release = await lockSession(sessionFile);
  try {
    let session;
    const existed = fs.existsSync(sessionFile);
    const snapshot = existed ? fs.readFileSync(sessionFile, "utf8") : null;
    if (existed) session = readSession(sessionFile, url, service, snapshot);
    else if (bootstrapAuthorization) session = { version: 1, service, baseUrl, cookies: [] };
    else throw createAuthRequiredError(service, "Сохранённая браузерная сессия не найдена.", sessionFile);
    validateSession(session, url, service, sessionFile);
    if (session.authRequired) throw createAuthRequiredError(service, "Сессия требует повторного входа; запросы остановлены.", sessionFile);
    const cookie = cookieHeader(session, url);
    // Credentials bootstrap only a missing session. An expired/rejected session
    // is recovered interactively, never by resending a password for every task.
    if (!cookie && existed) throw createAuthRequiredError(service, "Нет действующей сессии. Завершите браузерный вход.", sessionFile);
    const headers = new Headers(options.headers);
    headers.delete("authorization");
    headers.delete("cookie");
    if (cookie) headers.set("Cookie", cookie);
    else headers.set("Authorization", bootstrapAuthorization);
    const response = await fetchWithSpSecret(url, { ...options, headers, redirect: "manual" }, spSecret);
    const body = await response.text();
    const failed = isAuthenticationFailure(response, body);
    session = { ...session, cookies: cookiesFromResponse(session, url, response), updatedAt: new Date().toISOString() };
    if (failed || !session.cookies.length) session.authRequired = true;
    // An explicit login may finish while this request is in flight. Never
    // overwrite that fresh session with a late response from the old one.
    const current = fs.existsSync(sessionFile) ? fs.readFileSync(sessionFile, "utf8") : null;
    if (current === snapshot) saveSession(sessionFile, session);
    if (failed) throw withHttpDiagnostics(createAuthRequiredError(service,
      "Сессия отсутствует или истекла; дальнейшие запросы остановлены.", sessionFile), response, body);
    return { response, body };
  } finally {
    release();
  }
}

function isAuthenticationFailure(response, body = "") {
  if (response.status === 401) return true;
  if (response.status >= 300 && response.status < 400) return true;

  const loginReason = response.headers.get("x-seraph-loginreason") || "";
  if (/AUTHENTICATION|AUTHENTICATED_FAILED/i.test(loginReason)) return true;

  const finalUrl = response.url || "";
  if (response.redirected && /login|signin|saml|oauth/i.test(finalUrl)) return true;

  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("text/html") && /login|sign in|log in|войти|авторизац|saml|oauth/i.test(body);
}

module.exports = {
  createAuthRequiredError,
  getCookieHeader,
  isAuthenticationFailure,
  saveSession,
  cookiesFromResponse,
  fetchWithSession
};
