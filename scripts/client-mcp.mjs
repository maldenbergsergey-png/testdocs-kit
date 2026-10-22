import { spawnSync } from "node:child_process";

export function codexWriteApprovalMode({ noCli = false, run = spawnSync } = {}) {
  if (noCli) return "prompt";
  const probe = 'mcp_servers.testdocs_approval_probe={url="http://127.0.0.1:9/mcp",default_tools_approval_mode="writes"}';
  try {
    // `get` reads configuration only: it doesn't start a server or an OAuth flow.
    const result = run("codex", ["-c", probe, "mcp", "get", "testdocs_approval_probe", "--json"], {
      encoding: "utf8", timeout: 5000, maxBuffer: 1024 * 1024
    });
    if (result.status === 0 && JSON.parse(result.stdout).name === "testdocs_approval_probe") return "writes";
  } catch { /* Missing/older CLI or invalid existing config: use the compatible gate. */ }
  return "prompt";
}

export function authenticateMcpClients(servers, clients, {
  noCli = false, skipBrowserAuth = false, openCodeFormat = "stable", run = spawnSync,
  available = command => run(command, ["--version"], { stdio: "ignore" }).status === 0,
  log = console.log, warn = console.warn
} = {}) {
  if (!servers.length) return;
  const targets = [];
  if (clients.includes("codex")) targets.push({ label: "Codex", command: "codex", action: "login" });
  if (clients.includes("opencode")) targets.push({ label: "OpenCode", command: openCodeFormat === "v2" ? "opencode2" : "opencode", action: "auth" });
  if (!targets.length) log("Завершите авторизацию MCP в интерфейсе выбранного AI-клиента.");
  for (const target of targets) {
    const manual = noCli || skipBrowserAuth || !available(target.command);
    for (const server of servers) {
      const args = ["mcp", target.action, server.name];
      const command = `${target.command} ${args.join(" ")}`;
      if (manual) { log(`${target.label}: завершите вход в интерфейсе клиента или выполните ${command}`); continue; }
      log(`\nАвторизация ${target.label}: ${server.name}...`);
      const result = run(target.command, args, { stdio: "inherit" });
      if (result.status !== 0) warn(`${target.label}: авторизация ${server.name} не завершена. Повторите: ${command}`);
    }
  }
}
