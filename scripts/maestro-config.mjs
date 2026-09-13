import fs from "node:fs";
import path from "node:path";
import { getInstallHome } from "./paths.mjs";
import { requiresShell } from "./command-shell.mjs";

// Both current and older official CLI releases are used by testers.
export const maestroLocalTools = [
  "list_devices", "inspect_screen", "take_screenshot", "run", "cheat_sheet",
  "open_maestro_viewer", "inspect_view_hierarchy", "launch_app", "stop_app",
  "tap_on", "input_text", "back", "start_device", "check_flow_syntax",
  "run_flow", "run_flow_files", "query_docs"
];

export function validateMaestro(settings = {}) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw new Error("maestro: ожидается объект настроек.");
  }
  if (!["auto", "on", "off"].includes(settings.mode ?? "auto")) {
    throw new Error("Maestro: используйте режим auto, on или off.");
  }
  for (const key of ["command", "resolvedCommand", "javaHome", "androidHome"]) {
    if (settings[key] !== undefined && (typeof settings[key] !== "string" || !path.isAbsolute(settings[key]))) {
      throw new Error(`maestro.${key}: укажите абсолютный путь без аргументов команды.`);
    }
  }
}

function executable(file) {
  try {
    fs.accessSync(file, fs.constants.X_OK);
    return fs.statSync(file).isFile();
  } catch { return false; }
}

export function resolveMaestro(settings = {}, env = process.env, installHome = getInstallHome()) {
  validateMaestro(settings);
  const mode = settings.mode ?? "auto";
  const result = { ...settings, mode, enabled: false };
  delete result.resolvedCommand;
  if (mode === "off") return result;
  const names = process.platform === "win32" ? ["maestro.bat", "maestro.cmd", "maestro.exe"] : ["maestro"];
  const directories = [
    ...(env.PATH || "").split(path.delimiter).filter((entry) => path.isAbsolute(entry)),
    path.join(installHome, ".maestro", "bin"),
    ...(process.platform === "darwin" && !env.TESTDOCS_INSTALL_ROOT ? ["/opt/homebrew/bin", "/usr/local/bin"] : [])
  ];
  // An explicit path never silently falls back to a different installation.
  const candidates = settings.command ? [settings.command] : [
    ...directories.flatMap((directory) => names.map((name) => path.join(directory, name))),
    ...(settings.resolvedCommand ? [settings.resolvedCommand] : [])
  ];
  const command = candidates.find(executable);
  if (!command) {
    if (mode === "on") throw new Error("Maestro CLI не найден. Установите CLI и повторите npm run configure:maestro; путь можно задать через --maestro-command.");
    return result;
  }
  result.enabled = true;
  result.resolvedCommand = command;
  // Keep only SDK locations, never capture the full environment or credentials.
  result.javaHome ||= env.JAVA_HOME || undefined;
  result.androidHome ||= env.ANDROID_HOME || env.ANDROID_SDK_ROOT || undefined;
  validateMaestro(result);
  return result;
}

export function maestroLaunch(settings = {}, env = process.env) {
  validateMaestro(settings);
  if (!settings.enabled || settings.mode === "off") throw new Error("Maestro выключен; выполните npm run configure:maestro.");
  const command = settings.command || settings.resolvedCommand;
  if (!command || !executable(command)) throw new Error("Maestro CLI не найден; повторите npm run configure:maestro после установки CLI.");
  const extraPath = [path.dirname(command)];
  const runtimeEnv = { ...env };
  if (settings.javaHome) {
    runtimeEnv.JAVA_HOME = settings.javaHome;
    extraPath.push(path.join(settings.javaHome, "bin"));
  }
  if (settings.androidHome) {
    runtimeEnv.ANDROID_HOME = settings.androidHome;
    runtimeEnv.ANDROID_SDK_ROOT = settings.androidHome;
    extraPath.push(path.join(settings.androidHome, "platform-tools"), path.join(settings.androidHome, "emulator"));
  }
  runtimeEnv.PATH = [...extraPath, env.PATH || ""].join(path.delimiter);
  return { command, args: ["mcp"], env: runtimeEnv };
}

export function maestroSpawnCommand(command, platform = process.platform) {
  if (!requiresShell(command, platform)) return command;
  // cmd.exe expands these even in quotes. Reject instead of interpreting a path.
  if (/[%!^"\r\n]/.test(command)) throw new Error("Путь к Maestro содержит неподдерживаемые символы для Windows batch launcher.");
  return `"${command}"`;
}
