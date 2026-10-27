import fs from "node:fs";
import path from "node:path";
import { getDataDir, getInstallHome } from "./paths.mjs";
import { requiresShell } from "./command-shell.mjs";

// Runtime tools only. SDK installation, WDA signing and paid AI services are
// separate setup work, not a side effect of receiving a testing task.
export const appiumLocalTools = [
  "select_device", "appium_session_management", "appium_get_page_source",
  "appium_screenshot", "appium_find_element", "appium_find_elements",
  "appium_gesture", "appium_set_value", "appium_get_text", "appium_alert",
  "appium_mobile_keyboard", "appium_get_window_size", "appium_context",
  "appium_app_lifecycle", "appium_mobile_device_info", "appium_orientation",
  "appium_screen_recording"
];

export function validateAppium(settings = {}) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw new Error("appium: ожидается объект настроек.");
  }
  if (!["auto", "on", "off"].includes(settings.mode ?? "auto")) {
    throw new Error("Appium: используйте режим auto, on или off.");
  }
  if (settings.enabled !== undefined && typeof settings.enabled !== "boolean") {
    throw new Error("appium.enabled: ожидается boolean.");
  }
  for (const key of ["command", "resolvedCommand", "javaHome", "androidHome"]) {
    if (settings[key] !== undefined && (typeof settings[key] !== "string" || !path.isAbsolute(settings[key]))) {
      throw new Error(`appium.${key}: укажите абсолютный путь без аргументов команды.`);
    }
  }
}

function executable(file) {
  try {
    fs.accessSync(file, fs.constants.X_OK);
    return fs.statSync(file).isFile();
  } catch { return false; }
}

export function resolveAppium(settings = {}, env = process.env, installHome = getInstallHome()) {
  validateAppium(settings);
  const mode = settings.mode ?? "auto";
  const result = { ...settings, mode, enabled: false };
  delete result.resolvedCommand;
  if (mode === "off") return result;
  const names = process.platform === "win32" ? ["appium-mcp.cmd", "appium-mcp.exe", "appium-mcp.bat"] : ["appium-mcp"];
  const directories = [
    ...(env.PATH || "").split(path.delimiter).filter((entry) => path.isAbsolute(entry)),
    ...(process.platform === "win32" ? [path.join(env.APPDATA || path.join(installHome, "AppData", "Roaming"), "npm")] : []),
    ...(process.platform === "darwin" && !env.TESTDOCS_INSTALL_ROOT ? ["/opt/homebrew/bin", "/usr/local/bin"] : [])
  ];
  const candidates = settings.command ? [settings.command] : [
    ...directories.flatMap((directory) => names.map((name) => path.join(directory, name))),
    ...(settings.resolvedCommand ? [settings.resolvedCommand] : [])
  ];
  const command = candidates.find(executable);
  if (!command) {
    if (mode === "on") throw new Error("Appium MCP не найден. Установите appium-mcp и повторите npm run configure:appium; путь можно задать через --appium-command.");
    return result;
  }
  result.enabled = true;
  result.resolvedCommand = command;
  result.javaHome ||= env.JAVA_HOME || undefined;
  result.androidHome ||= env.ANDROID_HOME || env.ANDROID_SDK_ROOT || undefined;
  validateAppium(result);
  return result;
}

export function appiumLaunch(settings = {}, env = process.env) {
  validateAppium(settings);
  if (!settings.enabled || settings.mode === "off") throw new Error("Appium выключен; выполните npm run configure:appium.");
  const command = settings.command || settings.resolvedCommand;
  if (!command || !executable(command)) throw new Error("Appium MCP не найден; повторите npm run configure:appium после установки appium-mcp.");
  const runtimeEnv = { ...env, NO_UI: "true", AI_VISION_ENABLED: "false", SCREENSHOTS_DIR: path.join(getDataDir(), "appium", "captures") };
  const extraPath = [path.dirname(command), path.dirname(process.execPath)];
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
  return { command, args: [], env: runtimeEnv };
}

export function appiumSpawnCommand(command, platform = process.platform) {
  if (!requiresShell(command, platform)) return command;
  if (/[%!^"\r\n]/.test(command)) throw new Error("Путь к Appium содержит неподдерживаемые символы для Windows batch launcher.");
  return `"${command}"`;
}
