import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { saveSnapshot, listSnapshots, checkSnapshot, readSections } from "./context-store.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sample = JSON.parse(fs.readFileSync(path.join(root, "examples/good/reusable-feature-context.json")));
const scopeOf = ({ connection, project, feature, scope }) => ({ connection, project, feature, scope });
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "testdocs-context-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { directory, input: structuredClone(sample) };
}
function current(input, mutate = () => {}) {
  const value = {
    identity: scopeOf(input.identity),
    sources: input.sources.map(({ authority, retrievedAt, ...source }) => ({ ...source, checkedAt: "2026-10-05T10:00:00Z" }))
  };
  mutate(value);
  return value;
}

test("index stays compact; verified iOS reads only applicable selected Android-origin requirements", (t) => {
  const { directory, input } = fixture(t);
  const saved = saveSnapshot(input, directory);
  assert.ok(saved.path.startsWith(directory));
  assert.equal(saved.reuseStatus, "UNVERIFIED");
  const index = listSnapshots(scopeOf(input.identity), directory);
  assert.equal(index.snapshots.length, 1);
  assert.equal(index.snapshots[0].sections[0].content, undefined);
  assert.ok(!JSON.stringify(index).includes(input.sections[0].content));
  const result = readSections(input.identity, {
    currentSources: current(input), sectionIds: ["name-rule", "android-navigation"], targetPlatform: "ios"
  }, directory);
  assert.equal(result.status, "PARTIAL_REUSE");
  assert.equal(result.sections[0].content, input.sections[0].content);
  assert.equal(result.sections[1].status, "NOT_APPLICABLE");
  assert.equal(result.sections[1].content, undefined);
  if (process.platform !== "win32") assert.equal(fs.statSync(path.join(saved.path, "name-rule.md")).mode & 0o777, 0o600);
});

test("unverified, changed, partial and inaccessible sources cannot release cached facts", (t) => {
  const { directory, input } = fixture(t);
  saveSnapshot(input, directory);
  const states = [
    [undefined, "UNVERIFIED"],
    [current(input, (value) => { value.sources[0].revision = "4"; }), "CHANGED"],
    [current(input, (value) => { value.sources[0].ref = "https://wiki.example.invalid/pages/78"; }), "CHANGED"],
    [current(input, (value) => { value.sources[0].completeness = "PARTIAL"; }), "PARTIAL"],
    [current(input, (value) => { value.sources[0].completeness = "UNAVAILABLE"; }), "UNAVAILABLE"],
    [current(input, (value) => { value.sources = []; }), "UNVERIFIED"],
    [current(input, (value) => { value.sources[0].checkedAt = "2026-10-04T09:00:00Z"; }), "UNVERIFIED"]
  ];
  for (const [currentSources, expected] of states) {
    const result = readSections(input.identity, { sectionIds: ["name-rule"], currentSources }, directory);
    assert.equal(result.sources[0].status, expected);
    assert.equal(result.status, "REFRESH_REQUIRED");
    assert.equal(result.sections[0].content, undefined);
  }
  assert.throws(() => readSections(input.identity, {}, directory), /явного выбора/);
});

test("unchanged selected source does not require checks for unrelated sections", (t) => {
  const { directory, input } = fixture(t);
  saveSnapshot(input, directory);
  const ledger = current(input);
  ledger.sources = ledger.sources.slice(0, 1);
  const result = readSections(input.identity, { sectionIds: ["name-rule"], currentSources: ledger }, directory);
  assert.equal(result.status, "CURRENT");
  assert.equal(result.sources.length, 1);
  assert.equal(result.sections.length, 1);
  assert.equal(result.sections[0].content, input.sections[0].content);
});

test("null revision requires a matching complete-source fingerprint; local hashes are insufficient", (t) => {
  const { directory, input } = fixture(t);
  input.sources[0].revision = null;
  saveSnapshot(input, directory);
  let result = checkSnapshot(input.identity, { sectionIds: ["name-rule"], currentSources: current(input) }, directory);
  assert.equal(result.sources[0].status, "UNVERIFIED");
  input.sources[0].fingerprint = "a".repeat(64);
  saveSnapshot(input, directory);
  result = checkSnapshot(input.identity, { sectionIds: ["name-rule"], currentSources: current(input) }, directory);
  assert.equal(result.status, "CURRENT");
  result = checkSnapshot(input.identity, { sectionIds: ["name-rule"], currentSources: current(input, (value) => { value.sources[0].fingerprint = "b".repeat(64); }) }, directory);
  assert.equal(result.sources[0].status, "CHANGED");
});

test("fingerprint disagreement overrides a matching revision; partial saved material stays partial", (t) => {
  const { directory, input } = fixture(t);
  input.sources[0].fingerprint = "a".repeat(64);
  saveSnapshot(input, directory);
  let result = checkSnapshot(input.identity, { sectionIds: ["name-rule"], currentSources: current(input, (value) => { value.sources[0].fingerprint = "b".repeat(64); }) }, directory);
  assert.equal(result.sources[0].status, "CHANGED");
  input.sources[0].completeness = "PARTIAL";
  saveSnapshot(input, directory);
  result = checkSnapshot(input.identity, { sectionIds: ["name-rule"], currentSources: current(input, (value) => { value.sources[0].completeness = "COMPLETE"; }) }, directory);
  assert.equal(result.sources[0].status, "PARTIAL");
});

test("connection, project, feature, scope and slug collisions remain isolated", (t) => {
  const { directory, input } = fixture(t);
  const paths = new Set([saveSnapshot(input, directory).path]);
  for (const field of ["connection", "project", "feature", "scope"]) {
    const other = structuredClone(input);
    other.identity[field] += " / other";
    paths.add(saveSnapshot(other, directory).path);
    assert.equal(listSnapshots(scopeOf(other.identity), directory).snapshots.length, 1);
    assert.throws(() => checkSnapshot(input.identity, { sectionIds: ["name-rule"], currentSources: current(other) }, directory), /другому scope/);
  }
  assert.equal(paths.size, 5);
  assert.equal(listSnapshots(scopeOf(input.identity), directory).snapshots.length, 1);
  assert.deepEqual(listSnapshots({ ...scopeOf(input.identity), connection: "unknown" }, directory), { snapshots: [] });
  const a = structuredClone(input);
  const b = structuredClone(input);
  a.identity.feature = "Feature/A";
  b.identity.feature = "Feature A";
  assert.notEqual(saveSnapshot(a, directory).path, saveSnapshot(b, directory).path);
});

test("immutable updates retain prior snapshots and existing reports; identical saves are idempotent", (t) => {
  const { directory, input } = fixture(t);
  const evidence = path.join(directory, "projects", "existing", "evidence.txt");
  fs.mkdirSync(path.dirname(evidence), { recursive: true });
  fs.writeFileSync(evidence, "old execution evidence");
  const first = saveSnapshot(input, directory);
  assert.equal(saveSnapshot(input, directory).snapshotId, first.snapshotId);
  input.sources[0].revision = "4";
  input.sections[0].content += " New source wording.";
  const second = saveSnapshot(input, directory);
  assert.notEqual(second.snapshotId, first.snapshotId);
  assert.ok(fs.existsSync(first.path));
  assert.equal(fs.readFileSync(path.join(first.path, "name-rule.md"), "utf8"), sample.sections[0].content);
  assert.equal(listSnapshots(scopeOf(input.identity), directory).snapshots[0].snapshotId, second.snapshotId);
  assert.equal(fs.readFileSync(evidence, "utf8"), "old execution evidence");
});

test("local tampering is rejected and section IDs cannot escape the snapshot", (t) => {
  const { directory, input } = fixture(t);
  let saved = saveSnapshot(input, directory);
  fs.writeFileSync(path.join(saved.path, "name-rule.md"), "tampered");
  assert.throws(() => readSections(input.identity, { sectionIds: ["name-rule"], currentSources: current(input) }, directory), /целостность содержимого/);
  const updated = structuredClone(input);
  updated.sources[0].revision = "4";
  const newer = saveSnapshot(updated, directory);
  assert.throws(() => saveSnapshot(input, directory), /целостность содержимого/);
  assert.equal(listSnapshots(scopeOf(input.identity), directory).snapshots[0].snapshotId, newer.snapshotId);
  saved = newer;
  const manifestFile = path.join(saved.path, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestFile));
  manifest.sources[0].revision = "unrelated";
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));
  assert.throws(() => listSnapshots(scopeOf(input.identity), directory), /целостность метаданных/);
  input.sections[0].id = "../../outside";
  assert.throws(() => saveSnapshot(input, directory), /Некорректный ID/);
});

test("shared storage needs a target platform; observations cannot masquerade as requirements", (t) => {
  const { directory, input } = fixture(t);
  input.identity.platform = "shared";
  saveSnapshot(input, directory);
  assert.throws(() => checkSnapshot(input.identity, {}, directory), /Target platform/);
  const result = readSections(input.identity, { targetPlatform: "web", sectionIds: ["name-rule"], currentSources: current(input) }, directory);
  assert.equal(result.sections[0].status, "NOT_APPLICABLE");
  assert.equal(result.sections[0].content, undefined);
  input.sources[0].authority = "observation";
  assert.throws(() => saveSnapshot(input, directory), /не является требованием/);
});

test("schema rejects empty sections, duplicate IDs, unknown credential fields and unsafe refs", (t) => {
  const { directory } = fixture(t);
  for (const mutate of [
    (input) => { input.sections[0].content = ""; },
    (input) => { input.sections.push(structuredClone(input.sections[0])); },
    (input) => { input.sources.push(structuredClone(input.sources[0])); },
    (input) => { input.sources[0].token = "sensitive-fixture-value"; },
    (input) => { input.sources[0].ref = "https://user:sensitive-fixture-value@example.invalid/spec"; },
    (input) => { input.sources[0].ref = "https://example.invalid/spec?access_token=sensitive-fixture-value"; },
    (input) => { input.sections[0].sourceIds = ["missing-source"]; }
  ]) {
    const input = structuredClone(sample);
    mutate(input);
    assert.throws(() => saveSnapshot(input, directory));
    assert.ok(!fs.existsSync(path.join(directory, "context")), "Invalid data was written");
  }
});

test("CLI works in an isolated data root and reports refresh gaps without leaking content", (t) => {
  const { directory, input } = fixture(t);
  const filename = path.join(directory, "input.json");
  fs.writeFileSync(filename, JSON.stringify(input));
  const invoke = (args) => spawnSync(process.execPath, [path.join(root, "scripts/context-store.mjs"), ...args], {
    cwd: directory, env: { ...process.env, TESTDOCS_DATA_DIR: directory }, encoding: "utf8"
  });
  const saved = invoke(["save", "--file", filename]);
  assert.equal(saved.status, 0, saved.stderr);
  const keys = Object.entries(input.identity).flatMap(([name, value]) => [`--${name}`, value]);
  const read = invoke(["read", ...keys, "--section", "name-rule"]);
  assert.equal(read.status, 0, read.stderr);
  assert.equal(JSON.parse(read.stdout).status, "REFRESH_REQUIRED");
  assert.equal(JSON.parse(read.stdout).sections[0].content, undefined);
  assert.equal(invoke(["save", "--file", filename, "--section", "name-rule"]).status, 1);
});
