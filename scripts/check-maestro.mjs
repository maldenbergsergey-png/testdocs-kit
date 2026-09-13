#!/usr/bin/env node
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { getConfigFile } from "./paths.mjs";
import { maestroLaunch, maestroSpawnCommand } from "./maestro-config.mjs";
import { requiresShell } from "./command-shell.mjs";

try {
  const config = JSON.parse(fs.readFileSync(getConfigFile(), "utf8"));
  const launch = maestroLaunch(config.maestro);
  for (const args of [["--version"], ["--help"]]) {
    const result = spawnSync(maestroSpawnCommand(launch.command), args, {
      env: launch.env, shell: requiresShell(launch.command), encoding: "utf8", timeout: 30000
    });
    if (result.error || result.status !== 0) {
      throw new Error(`Maestro ${args.join(" ")}: запуск не удался. Проверьте Java 17+, JAVA_HOME и CLI в терминале.`);
    }
    if (args[0] === "--help" && !/\bmcp\b/.test(result.stdout)) {
      throw new Error("Установленный Maestro CLI не объявляет подкоманду mcp. Обновите CLI по официальной инструкции.");
    }
  }
  console.log("Maestro CLI запускается и поддерживает mcp. MCP-handshake, устройство и приложение ещё не проверены; после перезапуска клиента вызовите list_devices и осмотрите экран выбранного устройства.");
} catch (error) {
  console.error(`Testdocs Kit: ${error.message}`);
  process.exitCode = 1;
}
