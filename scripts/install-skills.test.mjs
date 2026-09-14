import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { verifySkillResources } from "./verify-skills.mjs";
import { installSkillSet } from "./install-skills.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const noLinks = () => { throw Object.assign(new Error("Links unavailable"), { code: "EPERM" }); };
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "testdocs skills "));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, destinationRoot: path.join(root, "client", "skills"), storageRoot: path.join(root, "private", "skill-pack"), log() {}, warn() {} };
}
function links(filename) {
  const text = fs.readFileSync(fs.realpathSync(filename), "utf8");
  return [...text.matchAll(/\]\((?:<([^>]+)>|([^\s)]+))\)/g)].map((match) => match[1] ?? match[2])
    .filter((link) => !/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(link))
    .map((link) => path.resolve(path.dirname(fs.realpathSync(filename)), link.split("#")[0]));
}

test("fallback exports all actual skills with working rule links and runnable workspace helper, without the checkout", (t) => {
  const f = fixture(t);
  installSkillSet({ ...f, repoRoot: repo, link: noLinks });
  for (const skill of fs.readdirSync(path.join(repo, "skills"))) {
    const installed = path.join(f.destinationRoot, skill, "SKILL.md");
    assert(fs.existsSync(installed));
    for (const link of links(installed)) {
      assert(fs.existsSync(link), `${skill}: ${link}`);
      assert(!link.startsWith(repo), `Copy still depends on checkout: ${link}`);
    }
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(f.destinationRoot, "execute-task-testing", ".testdocs-kit-install.json")));
  const child = spawnSync(process.execPath, [path.join(manifest.resources, "scripts", "task-workspace.mjs"), "init", "--project", "Demo", "--task", "QA-1", "--json"], {
    cwd: f.root, env: { ...process.env, TESTDOCS_DATA_DIR: path.join(f.root, "data") }, encoding: "utf8"
  });
  assert.equal(child.status, 0, child.stderr);
  assert(JSON.parse(child.stdout).path.startsWith(path.join(f.root, "data")));
  assert(!fs.existsSync(path.join(manifest.resources, ".git")));
  assert(!fs.existsSync(path.join(manifest.resources, "MCP-OLD")));
});

test("managed copies update automatically, edited copies survive, and forced backups stay outside discovery", (t) => {
  const f = fixture(t);
  const source = path.join(f.root, "source");
  fs.mkdirSync(path.join(source, "skills", "demo"), { recursive: true });
  fs.mkdirSync(path.join(source, "rules"));
  const skill = path.join(source, "skills", "demo", "SKILL.md");
  fs.writeFileSync(skill, "v1\n[rule](../../rules/core.md)\n");
  fs.writeFileSync(path.join(source, "rules", "core.md"), "rule v1");
  const install = (extra = {}) => installSkillSet({ ...f, repoRoot: source, link: noLinks, ...extra });
  install();
  const target = path.join(f.destinationRoot, "demo", "SKILL.md");
  fs.writeFileSync(skill, "v2\n[rule](../../rules/core.md)\n");
  fs.writeFileSync(path.join(source, "rules", "core.md"), "rule v2");
  install();
  assert.match(fs.readFileSync(target, "utf8"), /^v2/);
  assert.equal(fs.readFileSync(links(target)[0], "utf8"), "rule v2");
  const backupCount = fs.readdirSync(path.join(f.storageRoot, "backups")).length;
  install();
  assert.equal(fs.readdirSync(path.join(f.storageRoot, "backups")).length, backupCount, "Unchanged copy was replaced again");
  fs.appendFileSync(target, "User edit\n");
  fs.writeFileSync(skill, "v3\n[rule](../../rules/core.md)\n");
  const warnings = [];
  install({ warn: (text) => warnings.push(text) });
  assert.match(fs.readFileSync(target, "utf8"), /User edit/);
  assert.equal(warnings.length, 1);
  install({ force: true });
  assert.match(fs.readFileSync(target, "utf8"), /^v3/);
  assert.deepEqual(fs.readdirSync(f.destinationRoot), ["demo"]);
  const backups = fs.readdirSync(path.join(f.storageRoot, "backups"));
  assert(backups.some((backup) => fs.readFileSync(path.join(f.storageRoot, "backups", backup, "demo", "SKILL.md"), "utf8").includes("User edit")));
  fs.renameSync(source, `${source}-moved`);
  assert.equal(fs.readFileSync(links(target)[0], "utf8"), "rule v2");
});

test("failed export preserves the previous installation; unknown directories require explicit replacement", (t) => {
  const f = fixture(t);
  const source = path.join(f.root, "source");
  fs.mkdirSync(path.join(source, "skills", "demo"), { recursive: true });
  fs.mkdirSync(path.join(f.destinationRoot, "demo"), { recursive: true });
  fs.writeFileSync(path.join(f.destinationRoot, "demo", "SKILL.md"), "Unmanaged content");
  fs.writeFileSync(path.join(source, "skills", "demo", "SKILL.md"), "[missing](../../rules/absent.md)");
  installSkillSet({ ...f, repoRoot: source, link: noLinks });
  assert.throws(() => installSkillSet({ ...f, repoRoot: source, link: noLinks, force: true }), /Unresolved skill resource/);
  assert.equal(fs.readFileSync(path.join(f.destinationRoot, "demo", "SKILL.md"), "utf8"), "Unmanaged content");
});

test("normal symlink installs retain relative resource resolution and are idempotent", (t) => {
  const f = fixture(t);
  installSkillSet({ ...f, repoRoot: repo });
  installSkillSet({ ...f, repoRoot: repo });
  const installed = path.join(f.destinationRoot, "generate-test-cases", "SKILL.md");
  assert.equal(fs.realpathSync(installed), path.join(repo, "skills", "generate-test-cases", "SKILL.md"));
  for (const link of links(installed)) assert(fs.existsSync(link), link);
  assert(!fs.existsSync(path.join(f.storageRoot, "backups")));
});

test("installation verification rejects legacy copies whose shared rules were not installed", (t) => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.destinationRoot, "demo"), { recursive: true });
  fs.writeFileSync(path.join(f.destinationRoot, "demo", "SKILL.md"), "[rules](../../rules/core.md)");
  assert.throws(() => verifySkillResources(f.destinationRoot, ["demo"]), /недоступен ресурс/);
});
