import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function markdown(directory) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const name = path.join(directory, entry.name);
    return entry.isDirectory() ? markdown(name) : entry.name.endsWith(".md") ? [name] : [];
  });
}
const skillNames = fs.readdirSync(path.join(root, "skills"));
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("all skill discovery entries and UI metadata are complete and consistent", () => {
  for (const name of skillNames) {
    const source = read(`skills/${name}/SKILL.md`);
    assert(source.startsWith("---\n"), name);
    assert.equal(source.match(/^name: (.+)$/m)?.[1], name);
    const description = source.match(/^description: (.+)$/m)?.[1];
    assert(!/: | #/.test(description || ""), `${name}: quote YAML values containing separators`);
    assert(description && description.length <= 650, `${name}: ambiguous or oversized discovery entry`);
    assert(source.includes("../../rules/core.md"), `${name}: installed skill lacks common contract`);
    const metadata = read(`skills/${name}/agents/openai.yaml`);
    for (const line of metadata.split("\n").filter((line) => /^  \w+: /.test(line))) JSON.parse(line.slice(line.indexOf(": ") + 2));
    const short = metadata.match(/short_description: "([^"]+)"/)?.[1];
    assert(short && short.length >= 25 && short.length <= 64, `${name}: short description`);
    assert(metadata.includes(`$${name}`), `${name}: default prompt must invoke its own skill`);
    assert(!metadata.includes("allow_implicit_invocation: false"), `${name}: natural discovery disabled`);
  }
});

test("repository instruction and documentation links resolve, including split rule files", () => {
  for (const name of ["README.md", "AGENTS.md", ...["skills", "rules", "integrations", "docs", "examples", "evals"].flatMap(markdown)]) {
    for (const match of read(name).matchAll(/\]\((?:<([^>]+)>|([^\s)]+))\)/g)) {
      const href = match[1] ?? match[2];
      const [link, anchor] = href.split("#");
      if (/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(link) || (link && !/\.(?:md|mjs|cjs|json|js|sh)$/.test(link))) continue;
      const target = link ? path.resolve(root, path.dirname(name), link) : path.join(root, name);
      assert(fs.existsSync(target), `${name}: broken reference ${link}`);
      if (anchor && target.endsWith(".md")) {
        const headings = [...fs.readFileSync(target, "utf8").matchAll(/^#{1,6} (.+)$/gm)]
          .map((heading) => heading[1].toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, "").replaceAll(" ", "-"));
        assert(headings.includes(decodeURIComponent(anchor)), `${name}: missing heading ${href}`);
      }
    }
  }
});

test("common context and formerly oversized entry points retain explicit size budgets", () => {
  for (const [name, maxCharacters] of Object.entries({
    "AGENTS.md": 2600,
    "rules/core.md": 5500,
    "rules/task-explanation-rules.md": 1600,
    "rules/task-execution-rules.md": 8500,
    "rules/integration-rules.md": 16000,
    "skills/generate-test-cases/SKILL.md": 6000,
    "skills/prepare-task-testing/SKILL.md": 3000,
    "skills/collect-test-context/SKILL.md": 9000
  })) assert(read(name).length <= maxCharacters, `${name} exceeds reviewed character budget ${maxCharacters}`);
  assert(!read("skills/explain-task-testing/SKILL.md").includes("task-execution-rules.md"));
});

test("routing corpus covers every entry point and its key artifact boundaries", () => {
  const fixtures = JSON.parse(read("evals/routing.json"));
  assert.equal(new Set(fixtures.map((row) => row.id)).size, fixtures.length);
  assert.deepEqual(new Set(fixtures.map((row) => row.skill)), new Set(skillNames));
  for (const row of fixtures) {
    assert(row.prompt && row.artifact && typeof row.collect === "boolean", row.id);
    assert(read("rules/task-testing-rules.md").includes(`\`${row.skill}\``), `${row.id}: route absent from canonical table`);
  }
});
