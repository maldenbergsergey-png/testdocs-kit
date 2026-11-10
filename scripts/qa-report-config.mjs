import path from "node:path";

export function hasPersonalQaReport(config) {
  return Boolean(config.qaReport?.enabled && config.qaReport.personalToken);
}

export function usesQaReport(config) {
  return hasPersonalQaReport(config) || (config.qaReport?.enabled && config.enableQaReportImport === true);
}

export function validatePersonalQaReport(settings) {
  const url = URL.canParse(settings.baseUrl) ? new URL(settings.baseUrl) : null;
  const local = url?.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (!url || (url.protocol !== "https:" && !local) || url.username || url.password || url.search || url.hash ||
      !/^\/(?:api\/mcp\/personal\/?)?$/.test(url.pathname) ||
      !/^(?:[a-z\d._-]+|\[[a-f\d:]+\])$/i.test(url.hostname)) {
    throw new Error("Для личного MCP укажите HTTPS-адрес QA Report или его /api/mcp/personal без ключа и параметров. HTTP доступен на loopback.");
  }
  if (typeof settings.personalToken !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(settings.personalToken)) {
    throw new Error("Введите личный MCP-токен из профиля QA Report.");
  }
  if (settings.fileRoot && (typeof settings.fileRoot !== "string" || !path.isAbsolute(settings.fileRoot) || /[\r\n\0]/.test(settings.fileRoot))) {
    throw new Error("Для загрузки вложений QA Report укажите абсолютный путь к разрешённой папке.");
  }
  if (Number(process.versions.node.split(".")[0]) < 22) {
    throw new Error("Личный MCP QA Report требует Node.js 22 или новее.");
  }
  return url.origin;
}

export function personalQaReportLaunch(config) {
  if (!hasPersonalQaReport(config)) throw new Error("Личный MCP QA Report выключен. Настройка: npm run configure:delivery.");
  const settings = config.qaReport;
  const origin = validatePersonalQaReport(settings);
  // The official stdio package selects its role from the environment. Bind it
  // to this account even when the parent shell also has a one-off connection.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith("QA_REPORT_")));
  env.PATH = [path.dirname(process.execPath), env.PATH].filter(Boolean).join(path.delimiter);
  env.QA_REPORT_PERSONAL_URL = origin + "/api/mcp/personal";
  env.QA_REPORT_PERSONAL_TOKEN = settings.personalToken;
  env.QA_REPORT_MCP_READ_ONLY = settings.allowPersonalWrites === true ? "0" : "1";
  if (settings.fileRoot && settings.allowPersonalWrites === true) env.QA_REPORT_FILE_ROOT = settings.fileRoot;
  if (config.caFile) env.NODE_EXTRA_CA_CERTS = config.caFile;
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  return { command, args: ["--yes", "--ignore-scripts", "--package", origin + "/downloads/qa-report-mcp.tgz", "qa-report-mcp"], env };
}
