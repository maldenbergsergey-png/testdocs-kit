#!/usr/bin/env node
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { getConfigFile } from "./paths.mjs";
import { appiumLaunch, appiumSpawnCommand } from "./appium-config.mjs";
import { requiresShell } from "./command-shell.mjs";

try {
  const config = JSON.parse(fs.readFileSync(getConfigFile(), "utf8"));
  const launch = appiumLaunch(config.appium);
  // --version is not a documented CLI option and can start a server instead.
  const result = spawnSync(appiumSpawnCommand(launch.command), ["--help"], {
    env: launch.env, shell: requiresShell(launch.command), encoding: "utf8", timeout: 30000
  });
  if (result.error || result.status !== 0 || !/appium-mcp/i.test(`${result.stdout}\n${result.stderr}`)) {
    throw new Error("Appium MCP не запускается. Проверьте совместимую версию Node.js и appium-mcp в терминале.");
  }
  console.log("Appium MCP CLI запускается. MCP-handshake, Appium-сессия, WDA, устройство и приложение ещё не проверены; после перезапуска клиента проверьте tools и экран выбранного устройства.");
} catch (error) {
  console.error(`Testdocs Kit: ${error.message}`);
  process.exitCode = 1;
}
