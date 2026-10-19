const { validateHeaderValue } = require("node:http");
const responseDiagnostics = new WeakMap();

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

function requestRedactor(headers) {
  const authorization = headers.get("authorization") || "";
  const credential = authorization.replace(/^\S+\s+/, "");
  const cookie = headers.get("cookie") || "";
  const secrets = [headers.get("x-sp-secret"), authorization, credential, cookie];
  if (/^Basic\s/i.test(authorization)) {
    const decoded = Buffer.from(credential, "base64").toString("utf8");
    secrets.push(decoded, decoded.slice(decoded.indexOf(":") + 1));
  }
  for (const pair of cookie.split(";")) {
    const separator = pair.indexOf("=");
    if (separator >= 0) secrets.push(pair.slice(separator + 1).trim());
  }
  const values = [...new Set(secrets.filter(Boolean))].sort((a, b) => b.length - a.length);
  return (text) => values.reduce((result, secret) => redactSpSecret(result, secret), String(text));
}

function diagnosticUrl(value, redact) {
  const url = new URL(value);
  // Query values can contain credentials or private search text.
  return redact(`${url.origin}${url.pathname}${url.search ? "?[omitted]" : ""}`);
}

async function trackedFetch(url, options, redirects = 0) {
  const headers = new Headers(options.headers);
  const redact = requestRedactor(headers);
  const request = {
    sentAt: new Date().toISOString(),
    method: options.method || "GET",
    url: diagnosticUrl(url, redact),
    headers: {
      "X-Sp-Secret": headers.has("x-sp-secret"),
      Authorization: headers.has("authorization"),
      Cookie: headers.has("cookie"),
      "Content-Type": redact(headers.get("content-type") || "")
    },
    authScheme: /^(Basic|Bearer)\s/i.exec(headers.get("authorization") || "")?.[1].toLowerCase()
      || (headers.has("cookie") ? "cookie" : "none"),
    ...(typeof options.body === "string" ? { bodyBytes: Buffer.byteLength(options.body) } : {}),
    redirectsFollowed: redirects
  };
  const response = await fetch(url, options);
  responseDiagnostics.set(response, { request, redact });
  return response;
}

function redactHttpText(response, text) {
  return responseDiagnostics.get(response)?.redact(text) ?? String(text);
}

function withHttpDiagnostics(error, response, body = "") {
  const recorded = responseDiagnostics.get(response);
  if (!recorded) return error;
  const { request, redact } = recorded;
  const headers = {};
  // Only explicit diagnostic headers; never Set-Cookie or arbitrary values.
  for (const name of ["content-type", "server", "x-request-id", "x-correlation-id", "x-transaction-id", "x-arequestid", "atl-traceid", "traceparent", "x-seraph-loginreason"]) {
    const value = response.headers.get(name);
    if (value) headers[name] = redact(value).slice(0, 200);
  }
  const transactionId = /\bTransaction\s+ID\s*:\s*([A-Za-z0-9_-]{1,128})(?![A-Za-z0-9_-])/i.exec(body)?.[1];
  error.httpDiagnostics = {
    request,
    response: {
      status: response.status,
      ...(response.url ? { url: diagnosticUrl(response.url, redact) } : {}),
      redirected: Boolean(response.redirected),
      headers,
      ...(transactionId ? { transactionId: redact(transactionId) } : {})
    }
  };
  // The SDK returns Error.message as MCP tool text, including in OpenCode.
  error.message = `${redact(error.message)}\nHTTP diagnostics: ${JSON.stringify(error.httpDiagnostics)}`;
  return error;
}

async function fetchWithSpSecret(url, options, spSecret = "") {
  spSecret = validateSpSecret(spSecret);
  if (!spSecret) return trackedFetch(url, options);

  let target = new URL(url);
  const origin = target.origin;
  const headers = new Headers(options.headers);
  headers.set("X-Sp-Secret", spSecret);
  let request = { ...options, headers, redirect: "manual" };
  for (let redirects = 0; ; redirects += 1) {
    const response = await trackedFetch(target.toString(), request, redirects);
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

module.exports = { validateSpSecret, redactSpSecret, fetchWithSpSecret, withHttpDiagnostics, redactHttpText };
