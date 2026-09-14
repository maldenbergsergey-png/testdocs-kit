import fs from "node:fs";
import path from "node:path";

export function verifySkillResources(destinationRoot, skillNames) {
  for (const name of skillNames) {
    const entry = path.join(destinationRoot, name, "SKILL.md");
    if (!fs.existsSync(entry)) throw new Error(`Не установлен скилл: ${entry}`);
    const physical = fs.realpathSync(entry);
    const content = fs.readFileSync(physical, "utf8");
    for (const match of content.matchAll(/\]\((?:<([^>]+)>|([^\s)]+))\)/g)) {
      const href = (match[1] ?? match[2]).split("#")[0];
      if (!href || (!path.isAbsolute(href) && /^[a-z][a-z0-9+.-]*:/i.test(href))) continue;
      const resource = path.resolve(path.dirname(physical), href);
      if (!fs.existsSync(resource)) throw new Error(`Скилл ${name}: недоступен ресурс ${resource}. Повторите установку; для старой непомеченной копии используйте --force с резервной копией.`);
    }
  }
  return skillNames.length;
}
