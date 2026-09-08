export const FIGMA_DESKTOP_URL = "http://127.0.0.1:3845/mcp";

export function defaultFigmaMode(previous = {}, clients = []) {
  return previous.mode || (previous.url === FIGMA_DESKTOP_URL ? "desktop" : clients.includes("opencode") ? "browser" : "remote");
}

export function figmaConnection(mode, previous = {}) {
  if (!["desktop", "remote"].includes(mode)) throw new Error("Figma mode: используйте desktop или remote.");
  return {
    id: previous.id || "figma", provider: "figma", enabled: true,
    kind: "remote", mode,
    url: mode === "desktop" ? FIGMA_DESKTOP_URL : "https://mcp.figma.com/mcp",
    authMode: mode === "desktop" ? "none" : "oauth"
  };
}

export function isFigmaDesktop(connection) {
  return connection.provider === "figma" && connection.url === FIGMA_DESKTOP_URL && connection.authMode === "none";
}

export function applyFigmaMode(config, mode) {
  if (!["browser", "desktop", "remote", "off"].includes(mode)) throw new Error("--figma-mode: используйте browser, desktop, remote или off.");
  config.connections ||= {};
  const previous = (config.connections.mcp || []).find((item) => item.provider === "figma");
  config.connections.mcp = (config.connections.mcp || []).filter((item) => item.provider !== "figma");
  config.figma = { mode };
  if (mode === "browser") {
    config.browser = { ...config.browser, enabled: true, mode: config.browser?.mode || "persistent" };
  } else if (mode !== "off") config.connections.mcp.push(figmaConnection(mode, previous));
}
