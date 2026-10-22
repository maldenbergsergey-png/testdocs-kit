import test from "node:test";
import assert from "node:assert/strict";
import { authenticateMcpClients, codexWriteApprovalMode } from "./client-mcp.mjs";

test("Codex uses writes only after its CLI accepts a configuration-only probe", () => {
  let invocation;
  const result = codexWriteApprovalMode({ run: (...args) => { invocation = args; return { status: 0, stdout: '{"name":"testdocs_approval_probe"}' }; } });
  assert.equal(result, "writes");
  assert.equal(invocation[0], "codex");
  assert.deepEqual(invocation[1].slice(2), ["mcp", "get", "testdocs_approval_probe", "--json"]);
  assert.match(invocation[1][1], /default_tools_approval_mode="writes"/);
  assert.equal(invocation[2].timeout, 5000);
});

test("old/missing Codex CLI and no-cli installs retain an approval gate without outputting errors or secrets", () => {
  for (const run of [
    () => ({ status: 1, stderr: 'unknown variant writes; sentinel-private-value' }),
    () => ({ status: 0, stdout: 'unexpected response' }),
    () => ({ status: 0, stdout: '{"name":"other"}' }),
    () => { throw new Error('sentinel-private-value'); }
  ]) assert.equal(codexWriteApprovalMode({ run }), "prompt");
  assert.equal(codexWriteApprovalMode({ noCli: true, run: () => { throw new Error('CLI must not run'); } }), "prompt");
});

test("OpenCode-only OAuth does not depend on Codex", () => {
  const calls = [], checked = [];
  authenticateMcpClients([{ name: "testdocs_postman" }], ["opencode"], {
    available: command => { checked.push(command); return true; },
    run: (...args) => { calls.push(args); return { status: 0 }; }, log: () => {}, warn: () => {}
  });
  assert.deepEqual(checked, ["opencode"]);
  assert.deepEqual(calls.map(call => call.slice(0, 2)), [["opencode", ["mcp", "auth", "testdocs_postman"]]]);
});

test("each selected client's OAuth runs independently and one failure does not block another client", () => {
  const calls = [], warnings = [];
  authenticateMcpClients([{ name: "testdocs_postman" }], ["codex", "opencode"], {
    available: () => true,
    run: (command, args) => { calls.push([command, args]); return { status: command === "codex" ? 1 : 0 }; },
    log: () => {}, warn: message => warnings.push(message)
  });
  assert.deepEqual(calls, [["codex", ["mcp", "login", "testdocs_postman"]], ["opencode", ["mcp", "auth", "testdocs_postman"]]]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /codex mcp login testdocs_postman/);
});

test("manual authentication gives client-specific commands, honors skip flags and the OpenCode variant", () => {
  const messages = [];
  authenticateMcpClients([{ name: "testdocs_postman" }], ["codex", "opencode"], {
    noCli: true, openCodeFormat: "v2", available: () => { throw new Error('No CLI probes'); },
    run: () => { throw new Error('No login'); }, log: message => messages.push(message)
  });
  assert(messages.some(message => message.includes("codex mcp login testdocs_postman")));
  assert(messages.some(message => message.includes("opencode2 mcp auth testdocs_postman")));
  let called = false;
  authenticateMcpClients([{ name: "testdocs_postman" }], ["opencode"], {
    skipBrowserAuth: true, run: () => { called = true; }, log: () => {}
  });
  assert.equal(called, false);
});
