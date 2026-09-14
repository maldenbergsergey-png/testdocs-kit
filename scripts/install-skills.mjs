import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { verifySkillResources } from "./verify-skills.mjs";

const manifestName = ".testdocs-kit-install.json";
// Distributable resource roots; runtime configuration and task data live outside this tree.
const resourceEntries = ["skills", "rules", "integrations", "examples", "docs", "evals", "scripts", "README.md", "AGENTS.md", "package.json"];
const digest = (value) => crypto.createHash("sha256").update(value).digest("hex");

function files(root, relative = "", resourceMode = false) {
  return fs.readdirSync(path.join(root, relative), { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const name = path.join(relative, entry.name);
      if (entry.name === manifestName) return [];
      if (resourceMode && (entry.name.startsWith(".") || ["node_modules", "dist", "__pycache__"].includes(entry.name))) return [];
      if (entry.isDirectory()) return files(root, name, resourceMode);
      if (entry.isFile() && entry.name !== manifestName) return [name];
      throw new Error(`Unsupported entry in skill resources: ${name}`);
    });
}

function treeHash(root) {
  return digest(files(root).map((name) => `${name}\0${digest(fs.readFileSync(path.join(root, name)))}`).join("\n"));
}

function exists(target) {
  try { fs.lstatSync(target); return true; } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function resourceSnapshot(repoRoot, storageRoot) {
  const resources = resourceEntries.filter((name) => exists(path.join(repoRoot, name))).flatMap((name) =>
    fs.statSync(path.join(repoRoot, name)).isDirectory()
      ? files(path.join(repoRoot, name), "", true).map((child) => path.join(name, child)) : [name]);
  const version = digest(resources.map((name) => `${name}\0${digest(fs.readFileSync(path.join(repoRoot, name)))}`).join("\n"));
  const destination = path.join(storageRoot, "resources", version);
  if (exists(destination)) return destination;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const staging = fs.mkdtempSync(path.join(path.dirname(destination), ".staging-"));
  try {
    for (const name of resources) {
      const target = path.join(staging, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(repoRoot, name), target);
    }
    fs.renameSync(staging, destination);
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw error;
  }
  return destination;
}

// Exported skill links resolve into an immutable skill-resource snapshot outside skill discovery.
// Bundle links remain relative and keep working even if the development checkout moves.
function copySkill(destination, bundleRoot, name) {
  fs.cpSync(path.join(bundleRoot, "skills", name), destination, { recursive: true });
  for (const relative of files(destination).filter((file) => file.endsWith(".md"))) {
    const target = path.join(destination, relative);
    const text = fs.readFileSync(target, "utf8").replace(/\]\((?:<([^>]+)>|([^\s)]+))\)/g, (match, angled, plain) => {
      const href = angled ?? plain;
      if (/^(?:[a-z][a-z0-9+.-]*:|#|\/)/i.test(href)) return match;
      const [pathname, fragment] = href.split(/#(.*)/s);
      const resolved = path.resolve(bundleRoot, "skills", name, path.dirname(relative), pathname);
      if (!resolved.startsWith(`${bundleRoot}${path.sep}`) || !exists(resolved)) {
        throw new Error(`Unresolved skill resource: ${name}/${relative}: ${href}`);
      }
      return `](<${resolved.replaceAll(path.sep, "/")}${fragment === undefined ? "" : `#${fragment}`}>)`;
    });
    fs.writeFileSync(target, text);
  }
}

export function installSkillSet({ repoRoot, destinationRoot, storageRoot, force = false,
  link = fs.symlinkSync, log = console.log, warn = console.warn }) {
  fs.mkdirSync(destinationRoot, { recursive: true });
  let bundleRoot;
  for (const skill of fs.readdirSync(path.join(repoRoot, "skills"), { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
    const source = path.join(repoRoot, "skills", skill.name);
    const destination = path.join(destinationRoot, skill.name);
    let managed = false;
    if (exists(destination)) {
      const stat = fs.lstatSync(destination);
      if (stat.isSymbolicLink()) {
        try { if (fs.realpathSync(destination) === fs.realpathSync(source)) continue; } catch { /* Broken link: explicit replacement only. */ }
      } else if (stat.isDirectory()) {
        try {
          const manifest = JSON.parse(fs.readFileSync(path.join(destination, manifestName), "utf8"));
          managed = manifest.pack === "testdocs-kit" && manifest.source === source && manifest.hash === treeHash(destination);
        } catch { /* Unknown or locally edited copy: preserve unless forced. */ }
      }
      if (!managed && !force) {
        warn(`Скилл не обновлён (чужой или изменённый): ${destination}. Для замены с резервной копией используйте --force.`);
        continue;
      }
    }
    // Prepare a complete replacement before moving the existing skill.
    const stagingRoot = fs.mkdtempSync(path.join(path.dirname(destinationRoot), ".testdocs-install-"));
    const staged = path.join(stagingRoot, skill.name);
    try {
      try { link(source, staged, process.platform === "win32" ? "junction" : "dir"); }
      catch {
        bundleRoot ??= resourceSnapshot(repoRoot, storageRoot);
        copySkill(staged, bundleRoot, skill.name);
        if (exists(path.join(bundleRoot, "README.md"))) fs.appendFileSync(path.join(staged, "SKILL.md"), `\nInstalled resource root: [pack](<${bundleRoot.replaceAll(path.sep, "/")}/README.md>). Resolve helper commands using scripts/ against this resource root, not the current project directory.\n`);
        const manifest = { pack: "testdocs-kit", source, resources: bundleRoot, hash: treeHash(staged) };
        fs.writeFileSync(path.join(staged, manifestName), `${JSON.stringify(manifest, null, 2)}\n`);
      }
      if (managed && !fs.lstatSync(staged).isSymbolicLink() && treeHash(staged) === treeHash(destination)) continue;
      let backup;
      if (exists(destination)) {
        const backupRoot = path.join(storageRoot, "backups");
        fs.mkdirSync(backupRoot, { recursive: true });
        backup = path.join(fs.mkdtempSync(path.join(backupRoot, `${skill.name}-`)), skill.name);
        fs.renameSync(destination, backup);
      }
      try { fs.renameSync(staged, destination); }
      catch (error) {
        if (backup) fs.renameSync(backup, destination);
        throw error;
      }
      if (bundleRoot) log(`Скилл установлен с ресурсами: ${skill.name}`);
    } finally { fs.rmSync(stagingRoot, { recursive: true, force: true }); }
  }
  verifySkillResources(destinationRoot, fs.readdirSync(path.join(repoRoot, "skills"), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name));
  log(`Скиллы подключены: ${destinationRoot}`);
}
