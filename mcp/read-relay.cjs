const fs = require("node:fs");
const path = require("node:path");
const { validateHeaderValue } = require("node:http");
const { fetchWithSpSecret, withHttpDiagnostics, redactHttpText } = require("./atlassian-http.cjs");

function relayUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("READ_RELAY_CONFIG: нужен полный HTTPS-адрес шлюза."); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("READ_RELAY_CONFIG: нужна HTTPS-ссылка без логина, пароля и дополнительных параметров.");
  }
  return url.toString().replace(/\/+$/, "");
}

function validateRelay(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("READ_RELAY_CONFIG: неверная настройка шлюза.");
  if (typeof input.tokenFile !== "string" || !path.isAbsolute(input.tokenFile)) {
    throw new Error("READ_RELAY_CONFIG: нужен абсолютный путь к закрытому файлу ключа.");
  }
  const result = { ...input, url: relayUrl(input.url) };
  if (input.fallback !== undefined && !["none", "transient"].includes(input.fallback)) {
    throw new Error("READ_RELAY_CONFIG: неизвестный режим резервного чтения.");
  }
  if (input.knowledgeSearchUrl) {
    result.knowledgeSearchUrl = relayUrl(input.knowledgeSearchUrl);
    if (new URL(result.knowledgeSearchUrl).origin !== new URL(result.url).origin) {
      throw new Error("READ_RELAY_CONFIG: поиск документов должен находиться на том же сайте ассистента.");
    }
  }
  return result;
}

function readToken(file) {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || (process.platform !== "win32" && ((stat.mode & 0o077) || stat.uid !== process.getuid()))) {
      throw new Error();
    }
    const token = fs.readFileSync(file, "utf8").trim();
    if (!token || /\s/.test(token)) throw new Error();
    validateHeaderValue("Authorization", `Bearer ${token}`);
    return token;
  } catch {
    throw new Error("READ_RELAY_AUTH: ключ недоступен или файл не закрыт для других пользователей. Повторите отдельную настройку шлюза.");
  }
}

async function request(config, url, options) {
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") throw new Error("READ_RELAY_CONFIG: для шлюза требуется включённая проверка TLS.");
  const token = readToken(config.tokenFile);
  let response;
  try {
    response = await fetchWithSpSecret(url, {
      ...options, redirect: "manual", signal: AbortSignal.timeout(15000),
      headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${token}` }
    });
  } catch {
    throw Object.assign(new Error("READ_RELAY_NETWORK: шлюз недоступен."), { code: "READ_RELAY_NETWORK" });
  }
  let body;
  try { body = await response.text(); }
  catch { throw Object.assign(new Error("READ_RELAY_NETWORK: чтение ответа шлюза прервалось."), { code: "READ_RELAY_NETWORK" }); }
  if (!response.ok) {
    throw Object.assign(withHttpDiagnostics(new Error(`READ_RELAY_HTTP: ${response.status}. ${redactHttpText(response, body).slice(0, 400)}`), response, body), { code: "READ_RELAY_HTTP", status: response.status });
  }
  try { return JSON.parse(body); }
  catch { throw withHttpDiagnostics(new Error("READ_RELAY_RESPONSE: шлюз вернул ответ без корректного JSON."), response, body); }
}

function canFallback(config, error) {
  if (!config || config.fallback !== "transient") return false;
  return error.code === "READ_RELAY_NETWORK" ||
    (error.code === "READ_RELAY_HTTP" && error.status >= 500 && error.status <= 599);
}

async function readRelay(input, apiPath, params) {
  const config = validateRelay(input);
  // Only trusted adapter paths are accepted; callers cannot supply an absolute URL.
  if (!/^\/rest\/api\//.test(apiPath) || /[?#\\]|\.\./.test(apiPath)) throw new Error("READ_RELAY_PATH: недопустимый путь чтения.");
  const url = new URL(`${config.url}${apiPath}`);
  if (params) for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  return request(config, url.toString(), { method: "GET" });
}

async function searchKnowledge(input, question, topK = 5) {
  const config = validateRelay(input);
  if (!config.knowledgeSearchUrl) throw new Error("CAPABILITY_UNAVAILABLE: поиск знаний не настроен для этого подключения.");
  return request(config, config.knowledgeSearchUrl, {
    method: "POST", body: JSON.stringify({ question, top_k: Math.min(Math.max(Number(topK) || 5, 1), 25) })
  });
}

module.exports = { relayUrl, validateRelay, readToken, readRelay, searchKnowledge, canFallback };
