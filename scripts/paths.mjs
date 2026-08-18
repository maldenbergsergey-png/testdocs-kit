import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export const repoRoot = path.resolve(currentDir, "..");

export function getInstallHome() {
  return process.env.TESTDOCS_INSTALL_ROOT
    ? path.resolve(process.env.TESTDOCS_INSTALL_ROOT)
    : os.homedir();
}

export function getConfigDir() {
  if (process.env.TESTDOCS_CONFIG_DIR) {
    return path.resolve(process.env.TESTDOCS_CONFIG_DIR);
  }

  if (process.env.TESTDOCS_INSTALL_ROOT) {
    return path.join(getInstallHome(), ".config", "testdocs-kit");
  }

  if (process.platform === "win32" && process.env.APPDATA) {
    return path.join(process.env.APPDATA, "testdocs-kit");
  }

  const xdgConfig = process.env.XDG_CONFIG_HOME;
  return path.join(xdgConfig ? path.resolve(xdgConfig) : path.join(getInstallHome(), ".config"), "testdocs-kit");
}

export function getConfigFile() {
  return process.env.TESTDOCS_CONFIG_FILE
    ? path.resolve(process.env.TESTDOCS_CONFIG_FILE)
    : path.join(getConfigDir(), "config.json");
}

export function getSessionFile(service) {
  return path.join(getConfigDir(), "sessions", `${service}.json`);
}

export function getCodexConfigFile() {
  return process.env.TESTDOCS_CODEX_CONFIG
    ? path.resolve(process.env.TESTDOCS_CODEX_CONFIG)
    : path.join(getInstallHome(), ".codex", "config.toml");
}

export function getOpenCodeConfigFile() {
  return process.env.TESTDOCS_OPENCODE_CONFIG
    ? path.resolve(process.env.TESTDOCS_OPENCODE_CONFIG)
    : path.join(getInstallHome(), ".config", "opencode", "opencode.json");
}

export const launcherFile = path.join(repoRoot, "scripts", "launch-mcp.mjs");
export const browserAuthFile = path.join(repoRoot, "scripts", "browser-auth.mjs");

export const serviceEntries = {
  jira: path.join(repoRoot, "mcp", "jira-mcp", "mcp-stdio.js"),
  confluence: path.join(repoRoot, "mcp", "confluence-mcp", "dist", "index.js"),
  delivery: path.join(repoRoot, "mcp", "jira-mcp", "mcp-stdio.js")
};
