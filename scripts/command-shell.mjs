export function requiresShell(command, platform = process.platform) {
  return platform === "win32" && /\.(?:cmd|bat)$/i.test(command);
}
