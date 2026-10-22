import fs from "node:fs";
import path from "node:path";
import { X509Certificate } from "node:crypto";
import { spawnSync } from "node:child_process";

export function validateRepositoryCa(file) {
  let certificates;
  try {
    certificates = fs.readFileSync(file, "utf8").match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);
  } catch { throw new Error("Файл корпоративного CA недоступен. Укажите существующий файл сертификата центра сертификации."); }
  try {
    if (!certificates?.length || certificates.some(pem => !new X509Certificate(pem).ca)) throw new Error();
  } catch { throw new Error("Нужен PEM-файл сертификата центра сертификации (CA). Сертификат самого сервера GitLab для этого не подходит."); }
}

// Node reads extra CA certificates at startup, not when process.env changes.
// Keep the same CLI and private token references; never put credentials in argv.
export function restartForRepositoryCa(config, { env = process.env, run = spawnSync, execPath = process.execPath, args = [...process.execArgv, ...process.argv.slice(1)] } = {}) {
  if (!config.caFile) return null;
  const caFile = path.resolve(config.caFile);
  validateRepositoryCa(caFile);
  if (env.NODE_EXTRA_CA_CERTS === caFile) return null;
  if (env.TESTDOCS_REPOSITORY_CA_READY === "1") throw new Error("Не удалось применить корпоративный CA. Повторите запуск команды проверки GitLab.");
  const result = run(execPath, args, {
    stdio: "inherit",
    env: { ...env, NODE_EXTRA_CA_CERTS: caFile, TESTDOCS_REPOSITORY_CA_READY: "1" }
  });
  if (result.error) throw new Error("Не удалось запустить проверку GitLab с корпоративным CA.");
  return { status: result.status ?? 1 };
}

export function gitlabConnectionError(error) {
  const pending = [error], codes = new Set();
  let redirect = false;
  for (let i = 0; i < pending.length && i < 12; i++) {
    const item = pending[i];
    if (!item || typeof item !== "object") continue;
    codes.add(item.code);
    redirect ||= item.message === "unexpected redirect";
    if (item.cause && !pending.includes(item.cause)) pending.push(item.cause);
    for (const child of Array.isArray(item.errors) ? item.errors : []) if (!pending.includes(child)) pending.push(child);
  }
  let code = "GITLAB_CONNECTION", message = "Не удалось подключиться к GitLab. Проверьте сеть и VPN.";
  if (["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "UNABLE_TO_GET_ISSUER_CERT", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "SELF_SIGNED_CERT_IN_CHAIN", "DEPTH_ZERO_SELF_SIGNED_CERT"].some(code => codes.has(code))) {
    code = "GITLAB_TLS_CA";
    message = "Не удалось подтвердить сертификат GitLab. Нужен доверенный сертификат центра сертификации (CA) компании. Получите его у ИТ и подключите через npm run configure:gitlab -- --ca-file /путь/к/company-ca.pem. Повторно вводить токен из-за этой ошибки не нужно.";
  } else if (["CERT_HAS_EXPIRED", "CERT_NOT_YET_VALID"].some(code => codes.has(code))) {
    code = "GITLAB_TLS_DATE";
    message = "Сертификат GitLab просрочен или ещё не действует. Проверьте дату на компьютере; если она верная, сообщите администратору GitLab.";
  } else if (codes.has("ERR_TLS_CERT_ALTNAME_INVALID")) {
    code = "GITLAB_TLS_HOST";
    message = "Сертификат сервера выдан на другой адрес. Проверьте адрес GitLab или сообщите администратору.";
  } else if (["ENOTFOUND", "EAI_AGAIN"].some(code => codes.has(code))) {
    code = "GITLAB_DNS";
    message = "Не удалось найти сервер GitLab по адресу. Проверьте адрес и подключение к корпоративной сети/VPN.";
  } else if (["ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "ABORT_ERR", 23].some(code => codes.has(code)) || error?.name === "TimeoutError") {
    code = "GITLAB_TIMEOUT";
    message = "GitLab не ответил за отведённое время. Проверьте сеть/VPN и доступность сервера.";
  } else if (redirect) {
    code = "GITLAB_REDIRECT";
    message = "GitLab перенаправляет запрос API. Проверьте адрес сервера; токен на другой адрес не пересылался.";
  }
  return Object.assign(new Error(message), { code });
}
