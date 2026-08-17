const fs = require("node:fs");

function createAuthRequiredError(service, reason) {
  const error = new Error(
    `AUTH_REQUIRED: ${reason} Откройте Terminal в каталоге testdocs-kit и выполните: npm run auth -- ${service}`
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

function getCookieHeader(sessionFile, requestUrl, service) {
  if (!sessionFile || !fs.existsSync(sessionFile)) {
    throw createAuthRequiredError(service, "Сохранённая браузерная сессия не найдена.");
  }

  let session;
  try {
    session = JSON.parse(fs.readFileSync(sessionFile, "utf8"));
  } catch (error) {
    throw createAuthRequiredError(service, `Не удалось прочитать браузерную сессию: ${error.message}.`);
  }

  const target = new URL(requestUrl);
  const storedUrl = new URL(session.baseUrl);
  const storedPath = storedUrl.pathname.replace(/\/$/, "") || "/";
  if (session.service !== service || target.origin !== storedUrl.origin || !pathMatches(target.pathname, storedPath)) {
    throw createAuthRequiredError(service, "Сессия создана для другого адреса сервиса.");
  }

  const now = Date.now() / 1000;
  const cookies = (Array.isArray(session.cookies) ? session.cookies : []).filter((cookie) => {
    if (!cookie?.name || typeof cookie.value !== "string") return false;
    if (!domainMatches(target.hostname, cookie.domain)) return false;
    if (!pathMatches(target.pathname, cookie.path)) return false;
    if (cookie.secure && target.protocol !== "https:") return false;
    if (Number(cookie.expires) > 0 && Number(cookie.expires) <= now) return false;
    return true;
  });

  if (!cookies.length) {
    throw createAuthRequiredError(service, "В сохранённой сессии нет действующих cookies для сервиса.");
  }

  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
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
  isAuthenticationFailure
};
