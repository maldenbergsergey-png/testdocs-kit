const publicationTool = "jira_publish_checklist_comment";
const managedTool = /^testdocs_jira(?:_[\w-]+)?_jira_publish_checklist_comment$/;
const effects = new Set(["allow", "ask", "deny"]);

// OpenCode matches tool names with * and ?, and evaluates the last matching rule.
// https://opencode.ai/docs/permissions/
function matches(pattern, tool) {
  const expression = [...pattern].map((char) => char === "*" ? ".*" : char === "?" ? "." : char.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")).join("");
  return new RegExp(`^${expression}$`).test(tool);
}

function stableRules(permission) {
  if (permission === undefined) return [];
  if (effects.has(permission)) return [{ action: "*", resource: "*", effect: permission }];
  if (!permission || typeof permission !== "object" || Array.isArray(permission)) throw new Error("Invalid OpenCode permission map.");
  return Object.entries(permission).flatMap(([action, value]) => {
    if (effects.has(value)) return [{ action, resource: "*", effect: value }];
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid OpenCode permission rule.");
    return Object.entries(value).map(([resource, effect]) => {
      if (!effects.has(effect)) throw new Error("Invalid OpenCode permission effect.");
      return { action, resource, effect };
    });
  });
}

function v2Rules(permissions) {
  if (permissions === undefined) return [];
  if (!Array.isArray(permissions) || permissions.some((rule) => !rule || typeof rule.action !== "string" || typeof rule.resource !== "string" || !effects.has(rule.effect))) {
    throw new Error("Invalid OpenCode V2 permissions array.");
  }
  return permissions;
}

function protect(container, format, tools, inherited = []) {
  const stable = stableRules(container.permission);
  const v2 = v2Rules(container.permissions);
  const foreign = format === "stable" ? v2 : stable;
  // Only migrate this installer's exact publication rules. Other permissions need
  // an explicit client-format migration, rather than silently losing restrictions.
  if (foreign.some((rule) => !managedTool.test(rule.action) || rule.resource !== "*")) {
    throw new Error("OpenCode permissions use another client format. Migrate those permissions before changing --opencode-format.");
  }
  const rules = [...(format === "stable" ? stable : v2), ...foreign];
  const names = [...new Set([...tools, ...foreign.map((rule) => rule.action)])];
  const guards = names.map((action) => ({
    action,
    resource: "*",
    // MCP tool calls use resource "*". Preserve the effective deny under the
    // client's last-match semantics, including global and agent-level rules.
    effect: [...inherited, ...rules].findLast((rule) => matches(rule.action, action) && matches(rule.resource, "*"))?.effect === "deny" ? "deny" : "ask"
  }));
  if (format === "stable") {
    delete container.permissions;
    if (guards.length) {
      const permission = typeof container.permission === "string" ? { "*": container.permission } : { ...container.permission };
      for (const guard of guards) {
        delete permission[guard.action];
        permission[guard.action] = guard.effect;
      }
      container.permission = permission;
    }
  } else {
    delete container.permission;
    if (guards.length) container.permissions = [...rules.filter((rule) => !names.includes(rule.action)), ...guards];
  }
  return [...rules, ...guards];
}

export function withChecklistPublicationApproval(data, format, servers) {
  if (!["stable", "v2"].includes(format)) throw new Error("Unknown OpenCode format.");
  const next = structuredClone(data);
  const tools = servers.filter((server) => server.service === "jira" && server.tools?.includes(publicationTool))
    .map((server) => `${server.name}_${publicationTool}`);
  const hasManagedRules = (container) => Object.keys(container?.permission || {}).some((name) => managedTool.test(name))
    || (Array.isArray(container?.permissions) && container.permissions.some((rule) => managedTool.test(rule?.action)));
  if (!tools.length && ![next, ...Object.values(next.agent || {}), ...Object.values(next.agents || {})].some(hasManagedRules)) return next;
  const inherited = protect(next, format, tools);
  const agents = format === "stable" ? next.agent : next.agents;
  for (const agent of Object.values(agents || {})) {
    if (agent && typeof agent === "object") protect(agent, format, tools, inherited);
  }
  return next;
}
