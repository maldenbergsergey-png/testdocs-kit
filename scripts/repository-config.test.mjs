import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { collectRepositories, gitTransport, normalizeRepositories } from "./repository-config.mjs";
import { checkRepository } from "./check-repositories.mjs";
import { gitlabGet, sourceToken } from "./gitlab-read.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const postman = { enabled: true, url: "git@git.example.invalid:qa/collection.git", localPath: "", collectionPath: "postman/collections/API", baseBranch: "", allowPush: true };
const source = { id: "backend", enabled: true, transport: "gitlab_api", url: "https://code.example.invalid/gitlab", tokenEnv: "SOURCE_PAT", project: "", contractPath: "", defaultRef: "" };

test("independent collection and host-wide source bindings accept SSH aliases and preserve unresolved scope", () => {
  const config = normalizeRepositories({ postman, sources: [source] });
  assert.equal(config.postman.allowPush, true);
  assert.equal(config.sources[0].project, "");
  assert.equal(config.postman.baseBranch, "");
  assert.equal(gitTransport("ssh://git@private-alias:2222/team/api.git"), "ssh");
  assert.equal(gitTransport("https://git.example.invalid/team/api.git"), "https");
  for (const input of [
    { postman: { ...postman, url: "https://user:sentinel-secret@git.example.invalid/api.git" } },
    { postman: { ...postman, url: "https://git.example.invalid/api.git?token=sentinel-secret" } },
    { postman: { ...postman, collectionPath: "../other" } },
    { sources: [{ ...source, secret: "sentinel-secret" }] },
    { sources: [{ ...source, tokenEnv: "Bearer sentinel-secret" }] },
    { sources: [source, source] }
  ]) {
    assert.throws(() => normalizeRepositories(input), error => !error.message.includes("sentinel-secret"));
  }
});

test("independent wizard section preserves disabled bindings and supports optional source scope", async () => {
  const previous = { postman, sources: [source] };
  const result = await collectRepositories(previous, { section: "postman", confirm: async () => false, ask: async () => { throw new Error("Unexpected prompt"); } });
  assert.equal(result.postman.enabled, false);
  assert.deepEqual(result.sources, normalizeRepositories(previous).sources);
  const confirmations = [true, false, false];
  const enabled = await collectRepositories({ postman }, { section: "postman", confirm: async () => confirmations.shift(), ask: async (_, fallback) => fallback });
  assert.equal(enabled.postman.url, postman.url);
  assert.equal(enabled.postman.allowPush, false);
});

test("Git probe does not mutate checkout and never calls push/fetch/pull", async () => {
  const calls = [];
  const result = await checkRepository(postman, { remote: true, git: args => { calls.push(args); return `${"a".repeat(40)}\tHEAD`; } });
  assert.equal(result.readAccess, "verified_for_remote_head");
  assert.equal(result.pushAccess, "not_checked");
  assert.deepEqual(calls, [["ls-remote", "--exit-code", postman.url, "HEAD"]]);
});

test("source wizard stores a token reference once and does not require a project", async () => {
  const answers = ["backend", "gitlab_api", source.url, "", "", "", "SOURCE_PAT"];
  const confirmations = [true, true, false];
  const stored = [];
  const result = await collectRepositories({ postman }, {
    section: "sources", ask: async () => answers.shift(), confirm: async () => confirmations.shift(),
    askSecret: async () => "dummy-private-pat",
    saveToken: (id, token) => { stored.push({ id, token }); return "/private/tmp/source.token"; }
  });
  assert.deepEqual(stored, [{ id: "backend", token: "dummy-private-pat" }]);
  assert.deepEqual(result.postman, postman);
  assert.equal(result.sources[0].project, "");
  assert.equal(result.sources[0].tokenFile, "/private/tmp/source.token");
  assert(!JSON.stringify(result).includes("dummy-private-pat"));
});

test("read-only GitLab adapter keeps token in headers, preserves subpath, blocks writes/redirects and reports bounded errors", async () => {
  let request;
  const http = async (url, options) => { request = { url, options }; return new Response("[]", { status: 200 }); };
  const config = normalizeRepositories({ sources: [source] }).sources[0];
  await gitlabGet(config, "/projects?membership=true&per_page=1", { http, env: { SOURCE_PAT: "sentinel-secret" } });
  assert.equal(request.url, "https://code.example.invalid/gitlab/api/v4/projects?membership=true&per_page=1");
  assert.equal(request.options.headers["PRIVATE-TOKEN"], "sentinel-secret");
  assert.equal(request.options.redirect, "error");
  assert.equal(request.options.method, "GET");
  for (const bad of ["/users", "//outside.example.invalid/projects", "/projects?private_token=sentinel-secret", "/projects#fragment", "/projects/1/repository/../../../users"]) {
    await assert.rejects(gitlabGet(config, bad, { http, env: { SOURCE_PAT: "sentinel-secret" } }));
  }
  await assert.rejects(gitlabGet(config, "/projects", { method: "POST", http }));
  await assert.rejects(gitlabGet(config, "/projects", { env: { SOURCE_PAT: "sentinel-secret" }, http: async () => { throw new Error("sentinel-secret"); } }), error => !error.message.includes("sentinel-secret"));
  const probe = await checkRepository(config, { remote: true, http, env: { SOURCE_PAT: "sentinel-secret" } });
  assert.equal(probe.readAccess, "verified_for_projects_api");
  assert.equal(probe.readOnlyScopesVerified, false);
  assert(!JSON.stringify(probe).includes("sentinel-secret"));
});

test("file probe encodes task bindings and does not imply task SHA verification", async () => {
  let request;
  const config = normalizeRepositories({ sources: [{ ...source, project: "group/backend", contractPath: "api/contract.yaml", defaultRef: "task/QA-42" }] }).sources[0];
  const probe = await checkRepository(config, { remote: true, env: { SOURCE_PAT: "dummy" }, http: async (url, options) => { request = { url, options }; return new Response(null, { status: 200 }); } });
  assert.match(request.url, /group%2Fbackend\/repository\/files\/api%2Fcontract.yaml\?ref=task%2FQA-42$/);
  assert.equal(request.options.method, "HEAD");
  assert.equal(probe.probeOnly, true);
});

test("isolated installer round-trips repository bindings, private tokens remain references in show/client config", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "testdocs-repositories-"));
  try {
    const tokenFile = path.join(temp, "source.token");
    fs.writeFileSync(tokenFile, "sentinel-private-token", { mode: 0o600 });
    assert.equal(sourceToken({ tokenFile }, {}), "sentinel-private-token");
    const answers = path.join(temp, "answers.json");
    const repositories = { postman, sources: [{ ...source, tokenFile }] };
    fs.writeFileSync(answers, JSON.stringify({ version: 3, connections: { jira: [], confluence: [], eva: [], mcp: [] }, tms: { category: "none", provider: "none" }, maestro: { mode: "off" }, repositories }));
    const env = { ...process.env, TESTDOCS_INSTALL_ROOT: temp, TESTDOCS_CONFIG_DIR: path.join(temp, "config"), TESTDOCS_CODEX_CONFIG: path.join(temp, "codex.toml"), TESTDOCS_OPENCODE_CONFIG: path.join(temp, "opencode.json") };
    const args = [path.join(root, "scripts/install.mjs"), "--clients", "generic", "--skip-dependencies", "--no-cli", "--skip-browser-auth", "--auto-update", "off"];
    for (const extra of [["--answers", answers], ["--reuse"]]) {
      const result = spawnSync(process.execPath, [...args, ...extra], { cwd: root, env, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      assert(!(result.stdout + result.stderr).includes("sentinel-private-token"));
      const saved = JSON.parse(fs.readFileSync(path.join(temp, "config/config.json"), "utf8"));
      assert.deepEqual(saved.repositories, normalizeRepositories(repositories));
    }
    const show = spawnSync(process.execPath, [path.join(root, "scripts/check-repositories.mjs"), "--show"], { cwd: root, env, encoding: "utf8" });
    assert.equal(show.status, 0, show.stderr);
    assert.equal(JSON.parse(show.stdout).sources[0].tokenFile, tokenFile);
    assert(!show.stdout.includes("sentinel-private-token"));
    const invalid = spawnSync(process.execPath, [path.join(root, "scripts/check-repositories.mjs"), "--id"], { cwd: root, env, encoding: "utf8" });
    assert.notEqual(invalid.status, 0);
    const client = fs.readFileSync(path.join(temp, "config/client-snippets/generic-mcp.json"), "utf8");
    assert(!client.includes("sentinel-private-token") && !client.includes("source.token"));
    const isolated = spawnSync(process.execPath, [path.join(root, "scripts/install.mjs"), "--configure", "repository-sources", "--answers", answers], { cwd: root, env, encoding: "utf8" });
    assert.equal(isolated.status, 0, isolated.stderr);
    assert.equal(fs.readFileSync(path.join(temp, "config/client-snippets/generic-mcp.json"), "utf8"), client);
    assert(!isolated.stdout.includes("Авторизация remote MCP"));
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
