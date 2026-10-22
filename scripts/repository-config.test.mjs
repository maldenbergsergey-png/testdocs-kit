import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { collectGitLab, collectRepositories, gitTransport, normalizeRepositories } from "./repository-config.mjs";
import { checkGitLabConnections, checkRepository } from "./check-repositories.mjs";
import { gitlabGet, sourceToken } from "./gitlab-read.mjs";
import { gitlabConnectionError, restartForRepositoryCa, validateRepositoryCa } from "./repository-tls.mjs";

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

test("advanced source wizard remains available for explicit Git and scoped settings", async () => {
  const answers = ["backend", "gitlab_api", source.url, "", "", "", "SOURCE_PAT"];
  const confirmations = [true, true, false];
  const stored = [];
  const result = await collectRepositories({ postman }, {
    section: "sources", advanced: true, ask: async () => answers.shift(), confirm: async () => confirmations.shift(),
    askSecret: async () => "dummy-private-pat",
    saveToken: (id, token) => { stored.push({ id, token }); return "/private/tmp/source.token"; }
  });
  assert.deepEqual(stored, [{ id: "backend", token: "dummy-private-pat" }]);
  assert.deepEqual(result.postman, postman);
  assert.equal(result.sources[0].project, "");
  assert.equal(result.sources[0].tokenFile, "/private/tmp/source.token");
  assert(!JSON.stringify(result).includes("dummy-private-pat"));
});

test("GitLab asks only for address and hidden token, saves before offering another server, and No finishes", async () => {
  const questions = [], messages = [], events = [];
  const result = await collectRepositories({ postman }, {
    section: "sources", env: {}, log: message => messages.push(message),
    ask: async question => { questions.push(question); return `[GitLab](${source.url}/)`; },
    askSecret: async question => { questions.push(question); return "sentinel-private-pat"; },
    saveToken: (id, token) => { assert.equal(token, "sentinel-private-pat"); events.push("token"); return "/private/tmp/source.token"; },
    saveRepositories: async config => { assert.equal(config.sources.length, 1); events.push("saved"); },
    confirm: async (question, fallback, options) => {
      assert.equal(question, "Добавить ещё один сервер GitLab?");
      assert.equal(fallback, false);
      assert.equal(options.plain, true);
      events.push("another");
      return false;
    }
  });
  assert.equal(questions.length, 2);
  assert.match(questions[0], /^1\. Адрес сервера GitLab/);
  assert.match(questions[1], /^2\. Токен GitLab/);
  assert(!questions.some(question => /ID|tokenEnv|Ref|переменной|YAML|gitlab_api/.test(question)));
  assert.deepEqual(events, ["token", "saved", "another"]);
  assert.deepEqual(result.postman, postman);
  assert.equal(result.sources[0].url, source.url);
  assert.equal(result.sources[0].project, "");
  assert.equal(result.sources[0].contractPath, "");
  assert.equal(result.sources[0].defaultRef, "");
  assert(!JSON.stringify([result, messages, questions]).includes("sentinel-private-pat"));
});

test("GitLab retries invalid address or empty token locally, without exposing input or losing other sources", async () => {
  const git = { id: "code", enabled: true, transport: "git", url: "git@other.example.invalid:team/code.git" };
  const addresses = ["https://user:sentinel-secret@bad.example.invalid", "", "git.example.invalid"];
  const tokens = ["", "TESTDOCS_MR_GITLAB_TOKEN", "Bearer sentinel-secret", "dummy-pat"];
  const messages = [];
  const result = await collectGitLab({ postman, sources: [source, git] }, {
    env: {}, log: message => messages.push(message), ask: async () => addresses.shift(),
    askSecret: async () => tokens.shift(), confirm: async () => false,
    saveToken: () => "/private/tmp/new.token"
  });
  assert.equal(addresses.length, 0);
  assert.equal(tokens.length, 0);
  assert.equal(result.sources.length, 3);
  assert.equal(result.sources[2].url, "https://git.example.invalid");
  assert.deepEqual(result.sources.slice(0, 2), normalizeRepositories({ sources: [source, git] }).sources);
  assert(!messages.join("\n").includes("sentinel-secret"));
});

test("multiple GitLab servers and instance subpaths get distinct IDs; existing bindings and token can be reused", async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "testdocs-gitlab-wizard-"));
  try {
    const tokenFile = path.join(temp, "existing.token");
    fs.writeFileSync(tokenFile, "sentinel-private-pat", { mode: 0o600 });
    const previous = { postman, sources: [{ ...source, tokenFile, project: "team/api", contractPath: "openapi.yaml", defaultRef: "task/42", enabled: false }] };
    const addresses = [source.url, "https://code.example.invalid/another", "https://code.example.invalid/third"];
    const tokens = ["", "dummy-second", "dummy-third"];
    const confirmations = [true, true, false];
    const saved = [];
    const result = await collectGitLab(previous, {
      env: {}, log: () => {}, ask: async () => addresses.shift(), askSecret: async () => tokens.shift(),
      confirm: async () => confirmations.shift(), saveToken: id => path.join(temp, `${id}.token`),
      saveRepositories: config => saved.push(structuredClone(config))
    });
    assert.deepEqual(saved.map(config => config.sources.length), [1, 2, 3]);
    assert.equal(result.sources[0].id, "backend");
    assert.equal(result.sources[0].enabled, true);
    assert.equal(result.sources[0].tokenFile, tokenFile);
    assert.equal(result.sources[0].project, "team/api");
    assert.equal(result.sources[0].contractPath, "openapi.yaml");
    assert.equal(result.sources[0].defaultRef, "task/42");
    assert.equal(new Set(result.sources.map(source => source.id)).size, 3);
    assert(!JSON.stringify(result).includes("sentinel-private-pat"));
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test("plain GitLab check uses enabled hosts, gives actionable errors, and does not accept HTML as successful access", async () => {
  const messages = [];
  assert.equal(await checkGitLabConnections({}, { log: message => messages.push(message) }), false);
  assert.match(messages.pop(), /npm run configure:gitlab/);
  const config = { postman, sources: [source, { ...source, id: "disabled", enabled: false, url: "https://unused.example.invalid" }] };
  let calls = 0;
  assert.equal(await checkGitLabConnections(config, {
    env: { SOURCE_PAT: "sentinel-secret" }, log: message => messages.push(message),
    http: async (url, options) => { calls++; assert.match(url, /\/api\/v4\/projects\?/); assert.equal(options.method, "GET"); return new Response("[]"); }
  }), true);
  assert.equal(calls, 1);
  assert.match(messages.pop(), /Проверено чтение списка проектов/);
  for (const [status, expected] of [[401, /не принял токен/], [403, /право read_api/], [404, /адрес сервера/]]) {
    assert.equal(await checkGitLabConnections(config, { env: { SOURCE_PAT: "sentinel-secret" }, log: message => messages.push(message), http: async () => new Response("sentinel-secret", { status }) }), false);
    assert.match(messages.pop(), expected);
  }
  assert.equal(await checkGitLabConnections(config, { env: { SOURCE_PAT: "sentinel-secret" }, log: message => messages.push(message), http: async () => new Response("<html>sentinel-secret</html>") }), false);
  assert.match(messages.at(-1), /страницу вместо списка/);
  assert(!messages.join("\n").includes("sentinel-secret"));
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

test("GitLab connection errors distinguish TLS, DNS, timeout and redirects without exposing request data", async () => {
  for (const [cause, expected] of [
    [{ code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" }, "GITLAB_TLS_CA"],
    [{ code: "SELF_SIGNED_CERT_IN_CHAIN" }, "GITLAB_TLS_CA"],
    [{ code: "CERT_HAS_EXPIRED" }, "GITLAB_TLS_DATE"],
    [{ code: "ERR_TLS_CERT_ALTNAME_INVALID" }, "GITLAB_TLS_HOST"],
    [{ code: "ENOTFOUND" }, "GITLAB_DNS"],
    [{ errors: [{ code: "ENETUNREACH" }, { code: "ETIMEDOUT" }] }, "GITLAB_TIMEOUT"],
    [{ message: "unexpected redirect" }, "GITLAB_REDIRECT"],
    [{ code: "ECONNRESET" }, "GITLAB_CONNECTION"]
  ]) {
    const error = Object.assign(new Error("sentinel-private-token"), { cause: { ...cause, request: { token: "sentinel-private-token" } } });
    const result = gitlabConnectionError(error);
    assert.equal(result.code, expected);
    assert(!result.message.includes("sentinel-private-token"));
    await assert.rejects(gitlabGet(source, "/projects", { env: { SOURCE_PAT: "sentinel-private-token" }, http: async () => { throw error; } }), failure => failure.code === expected && !failure.message.includes("sentinel-private-token"));
  }
  assert.match(gitlabConnectionError({ cause: { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" } }).message, /--ca-file/);
});

test("repository CA starts a fresh Node process once, keeps secrets out of arguments and rejects invalid CA files", () => {
  const caFile = path.join(root, "certificates/globalsign-gcc-r3-dv-tls-ca-2020.pem");
  validateRepositoryCa(caFile);
  let call;
  const env = { SOURCE_PAT: "sentinel-private-token" };
  const result = restartForRepositoryCa({ caFile }, { env, args: ["check.mjs", "--gitlab"], run: (...args) => { call = args; return { status: 0 }; } });
  assert.equal(result.status, 0);
  assert.deepEqual(call[1], ["check.mjs", "--gitlab"]);
  assert(!JSON.stringify(call.slice(0, 2)).includes("sentinel-private-token"));
  assert.equal(call[2].env.NODE_EXTRA_CA_CERTS, caFile);
  assert.equal(call[2].env.SOURCE_PAT, "sentinel-private-token");
  assert.equal(call[2].env.NODE_TLS_REJECT_UNAUTHORIZED, undefined);
  assert.equal(restartForRepositoryCa({ caFile }, { env: call[2].env, run: () => { throw new Error("Unexpected respawn"); } }), null);
  assert.throws(() => restartForRepositoryCa({ caFile }, { env: { TESTDOCS_REPOSITORY_CA_READY: "1" } }), /Не удалось применить/);
  assert.throws(() => validateRepositoryCa(path.join(root, "package.json")), /PEM-файл/);
});

test("dedicated GitLab setup saves the CA flag and both repository CLIs load it at Node startup", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "testdocs-gitlab-ca-"));
  try {
    const configFile = path.join(temp, "config.json");
    const caFile = path.join(root, "certificates/globalsign-gcc-r3-dv-tls-ca-2020.pem");
    const tokenFile = path.join(temp, "private.token");
    fs.writeFileSync(tokenFile, "sentinel-private-token", { mode: 0o600 });
    fs.writeFileSync(configFile, JSON.stringify({ version: 3, clients: ["generic"], connections: { jira: [], confluence: [], eva: [], mcp: [] }, tms: { category: "none", provider: "none" }, repositories: { sources: [{ ...source, tokenFile }] } }));
    const env = { ...process.env, TESTDOCS_INSTALL_ROOT: temp, TESTDOCS_CONFIG_FILE: configFile, TESTDOCS_CONFIG_DIR: path.join(temp, "settings") };
    delete env.SOURCE_PAT;
    delete env.NODE_EXTRA_CA_CERTS;
    delete env.TESTDOCS_REPOSITORY_CA_READY;
    const configured = spawnSync(process.execPath, [path.join(root, "scripts/install.mjs"), "--configure", "gitlab", "--answers", configFile, "--ca-file", caFile], { cwd: root, env, encoding: "utf8" });
    assert.equal(configured.status, 0, configured.stderr);
    const saved = JSON.parse(fs.readFileSync(configFile, "utf8"));
    assert.equal(saved.caFile, caFile);
    assert.equal(saved.repositories.sources[0].tokenFile, tokenFile);
    assert(!JSON.stringify(saved).includes("sentinel-private-token"));
    const preload = path.join(temp, "mock-fetch.mjs");
    fs.writeFileSync(preload, `
      globalThis.fetch = async (_, options) => {
        if (process.env.NODE_EXTRA_CA_CERTS !== ${JSON.stringify(caFile)}) throw new Error('CA was not loaded at startup');
        if (options.headers['PRIVATE-TOKEN'] !== 'sentinel-private-token') throw new Error('Token was not loaded privately');
        return new Response('[]', { status: 200 });
      };
    `);
    const output = path.join(temp, "task-response.json");
    for (const args of [
      [path.join(root, "scripts/check-repositories.mjs"), "--gitlab"],
      [path.join(root, "scripts/gitlab-read.mjs"), "--source", "backend", "--api-path", "/projects", "--output", output]
    ]) {
      const checked = spawnSync(process.execPath, ["--import", preload, ...args], { cwd: root, env, encoding: "utf8" });
      assert.equal(checked.status, 0, checked.stderr);
      assert(!(checked.stdout + checked.stderr).includes("sentinel-private-token"));
    }
    assert.equal(fs.readFileSync(output, "utf8"), "[]");
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
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

function driveConfigurationWizard(env, interactions, target = "gitlab", extraArgs = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, "scripts/install.mjs"), "--configure", target, ...extraArgs], { cwd: root, env, stdio: ["pipe", "pipe", "pipe"] });
    let output = "", index = 0, cursor = 0;
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("Configuration wizard timed out")); }, 15000);
    const read = chunk => {
      output += chunk;
      const step = interactions[index];
      if (!step) return;
      const position = output.indexOf(step.prompt, cursor);
      if (position < 0) return;
      cursor = position + step.prompt.length;
      index++;
      if (step.cancel) child.kill("SIGINT");
      else child.stdin.write(`${step.answer}\n`);
    };
    child.stdout.on("data", read);
    child.stderr.on("data", read);
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.on("close", (status, signal) => { clearTimeout(timer); resolve({ status, signal, output, answered: index }); });
  });
}

test("interactive GitLab saves on No, reuses the same host, and preserves saved servers when the next entry is cancelled", async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "testdocs-gitlab-interactive-"));
  const configFile = path.join(temp, "config/config.json");
  const clientFile = path.join(temp, "codex.toml");
  const env = { ...process.env, TESTDOCS_INSTALL_ROOT: temp, TESTDOCS_CONFIG_DIR: path.dirname(configFile), TESTDOCS_CONFIG_FILE: configFile, TESTDOCS_CODEX_CONFIG: clientFile };
  const read = () => JSON.parse(fs.readFileSync(configFile, "utf8"));
  try {
    fs.mkdirSync(path.dirname(configFile));
    const previous = { version: 3, clients: ["codex"], connections: { jira: [], confluence: [], eva: [], mcp: [] }, tms: { category: "none", provider: "none" }, repositories: { postman, sources: [] }, qaReport: { enabled: false } };
    fs.writeFileSync(configFile, JSON.stringify(previous));
    fs.writeFileSync(clientFile, "# leave existing clients unchanged\n");
    const first = await driveConfigurationWizard(env, [
      { prompt: "1. Адрес сервера GitLab", answer: source.url },
      { prompt: "2. Токен GitLab", answer: "sentinel-private-pat" },
      { prompt: "Добавить ещё один сервер GitLab?", answer: "нет" }
    ]);
    assert.equal(first.status, 0, first.output);
    assert.equal(first.answered, 3);
    assert.match(first.output, /Настройка GitLab завершена/);
    assert(!first.output.includes("Уникальный ID") && !first.output.includes("переменной окружения"));
    assert(!first.output.includes("sentinel-private-pat"));
    const saved = read();
    assert.equal(saved.repositories.sources.length, 1);
    const entry = saved.repositories.sources[0];
    assert.equal(fs.readFileSync(entry.tokenFile, "utf8"), "sentinel-private-pat");
    if (process.platform !== "win32") assert.equal(fs.statSync(entry.tokenFile).mode & 0o777, 0o600);
    assert(!fs.readFileSync(configFile, "utf8").includes("sentinel-private-pat"));
    assert.deepEqual(saved.repositories.postman, postman);
    assert.deepEqual(saved.connections, previous.connections);
    const reuse = await driveConfigurationWizard(env, [
      { prompt: "1. Адрес сервера GitLab", answer: "" },
      { prompt: "2. Токен GitLab", answer: "" },
      { prompt: "Добавить ещё один сервер GitLab?", answer: "" }
    ], "repository-sources");
    assert.equal(reuse.status, 0, reuse.output);
    assert.deepEqual(read().repositories.sources, saved.repositories.sources);
    const aborted = await driveConfigurationWizard(env, [
      { prompt: "1. Адрес сервера GitLab", answer: "https://second.example.invalid" },
      { prompt: "2. Токен GitLab", answer: "dummy-second-pat" },
      { prompt: "Добавить ещё один сервер GitLab?", answer: "да" },
      { prompt: "1. Адрес сервера GitLab", cancel: true }
    ]);
    assert.equal(aborted.answered, 4);
    assert(aborted.status !== 0 || aborted.signal);
    assert.equal(read().repositories.sources.length, 2);
    assert.equal(read().repositories.sources[0].id, entry.id);
    assert.equal(read().repositories.sources[1].url, "https://second.example.invalid");
    assert.equal(fs.readFileSync(clientFile, "utf8"), "# leave existing clients unchanged\n");
    assert.equal(fs.existsSync(path.join(temp, "config/client-snippets")), false);
    assert(!aborted.output.includes("dummy-second-pat"));
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test("advanced Postman config preserves GitLab/repositories/CA and switches auth without stale headers", async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "testdocs-postman-config-"));
  const configFile = path.join(temp, "settings/config.json");
  const env = { ...process.env, TESTDOCS_INSTALL_ROOT: temp, TESTDOCS_CONFIG_DIR: path.dirname(configFile), TESTDOCS_CONFIG_FILE: configFile };
  try {
    fs.mkdirSync(path.dirname(configFile));
    const others = [
      { id: "figma", enabled: true, provider: "figma", kind: "remote", url: "https://mcp.figma.com/mcp", authMode: "oauth" },
      { id: "gitlab", enabled: true, provider: "gitlab", kind: "remote", url: "https://code.example.invalid/api/v4/mcp", authMode: "oauth" }
    ];
    const original = { version: 3, clients: ["generic"], connections: { jira: [], confluence: [], eva: [], mcp: others }, tms: { category: "none", provider: "none" }, repositories: { postman, sources: [source] }, caFile: path.join(root, "certificates/globalsign-gcc-r3-dv-tls-ca-2020.pem") };
    fs.writeFileSync(configFile, JSON.stringify(original));
    for (const choice of [
      { answers: ["", ""], region: "us", mode: "full", url: "https://mcp.postman.com/mcp", auth: "oauth" },
      { answers: ["2", "2"], region: "eu", mode: "full", url: "https://mcp.eu.postman.com/mcp", auth: "env_header" },
      { answers: ["1", "1"], region: "us", mode: "minimal", url: "https://mcp.postman.com/minimal", auth: "oauth" }
    ]) {
      const result = await driveConfigurationWizard(env, [
        { prompt: "Регион аккаунта Postman", answer: choice.answers[0] },
        { prompt: "Инструменты Postman", answer: choice.answers[1] }
      ], "postman", ["--advanced-postman"]);
      assert.equal(result.status, 0, result.output);
      assert.equal(result.answered, 2);
      assert.match(result.output, /Настройка Postman сохранена/);
      assert(!/Подключить официальный GitLab|Настроить доступ к GitLab|Настроить чтение макетов Figma|локальный MCP-handshake|Maestro/.test(result.output));
      const saved = JSON.parse(fs.readFileSync(configFile, "utf8"));
      assert.deepEqual(saved.connections.mcp.filter(item => item.provider !== "postman"), others);
      assert.deepEqual(saved.repositories, normalizeRepositories(original.repositories));
      assert.equal(saved.caFile, original.caFile);
      const entries = saved.connections.mcp.filter(item => item.provider === "postman");
      assert.equal(entries.length, 1);
      assert.equal(entries[0].region, choice.region);
      assert.equal(entries[0].mode, choice.mode);
      assert.equal(entries[0].authMode, choice.auth);
      assert.equal(entries[0].url, choice.url);
      const servers = JSON.parse(fs.readFileSync(path.join(temp, "settings/client-snippets/generic-mcp.json"), "utf8")).mcpServers;
      assert.equal(servers.testdocs_gitlab.url, others[1].url);
      assert.equal(servers.testdocs_postman.url, choice.url);
      if (choice.region === "eu") assert.equal(servers.testdocs_postman.headers.Authorization, "${TESTDOCS_POSTMAN_AUTH_HEADER}");
      else assert.equal(servers.testdocs_postman.headers, undefined);
    }
    assert.equal(fs.existsSync(path.join(temp, ".agents/skills")), false);
    const personal = await driveConfigurationWizard(env, [], "postman");
    assert.equal(personal.status, 0, personal.output);
    assert.equal(personal.answered, 0);
    assert(!/Регион аккаунта|Инструменты Postman|API key/.test(personal.output));
    assert.match(personal.output, /Postman: личный аккаунт/);
    assert.match(personal.output, /Репозиторий коллекции уже подключён/);
    const saved = JSON.parse(fs.readFileSync(configFile, "utf8"));
    assert.deepEqual(saved.repositories, normalizeRepositories(original.repositories));
    assert.equal(saved.caFile, original.caFile);
    assert.deepEqual(saved.connections.mcp.find(item => item.provider === "postman"), { id: "postman", provider: "postman", enabled: true, kind: "remote", region: "us", mode: "full", url: "https://mcp.postman.com/mcp", authMode: "oauth" });
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
