const { validateHeaderValue } = require("node:http");

function validateSpSecret(value = "") {
  if (typeof value !== "string") throw new Error("X-Sp-Secret должен быть строкой.");
  try {
    validateHeaderValue("X-Sp-Secret", value);
  } catch {
    throw new Error("X-Sp-Secret содержит недопустимые символы HTTP-заголовка.");
  }
  return value.trim();
}

function redactSpSecret(message, secret) {
  let text = String(message);
  const normalized = secret == null ? "" : String(secret).trim();
  if (normalized) {
    for (const value of new Set([String(secret), normalized, JSON.stringify(normalized).slice(1, -1), encodeURIComponent(normalized)])) {
      text = text.replaceAll(value, "[REDACTED]");
    }
  }
  return text;
}

async function fetchWithSpSecret(url, options, spSecret = "") {
  spSecret = validateSpSecret(spSecret);
  if (!spSecret) return fetch(url, options);

  let target = new URL(url);
  const origin = target.origin;
  const headers = new Headers(options.headers);
  headers.set("X-Sp-Secret", spSecret);
  let request = { ...options, headers, redirect: "manual" };
  for (let redirects = 0; ; redirects += 1) {
    const response = await fetch(target.toString(), request);
    if (options.redirect === "manual" || ![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) return response;
    await response.body?.cancel();
    if (redirects >= 20) throw new Error("Слишком много HTTP-редиректов Atlassian (больше 20).");
    let next;
    try { next = new URL(location, target); }
    catch { throw new Error("Некорректный адрес HTTP-редиректа Atlassian."); }
    // Unlike Authorization, fetch does not automatically strip custom secrets.
    if (next.origin !== origin || next.username || next.password) {
      throw new Error("Редирект с X-Sp-Secret на другой origin или адрес с учётными данными остановлен. Укажите конечный доверенный URL сервиса в настройках.");
    }
    const method = (request.method || "GET").toUpperCase();
    if (([301, 302].includes(response.status) && method === "POST") ||
        (response.status === 303 && !["GET", "HEAD"].includes(method))) {
      request = { ...request, method: "GET", body: undefined };
      for (const name of ["content-encoding", "content-language", "content-location", "content-type"]) headers.delete(name);
    }
    target = next;
  }
}

module.exports = { validateSpSecret, redactSpSecret, fetchWithSpSecret };
