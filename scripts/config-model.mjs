function slug(value, fallback) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return normalized || fallback;
}

function withUniqueIds(items, type) {
  const used = new Set();
  return (items || []).filter(Boolean).map((item, index) => {
    const base = slug(item.id || item.name, `${type}-${index + 1}`);
    let id = base;
    let suffix = 2;
    while (used.has(id)) id = `${base}-${suffix++}`;
    used.add(id);
    return { ...item, id, enabled: item.enabled !== false };
  });
}

export function migrateConfig(input = {}) {
  if (input.version === 2 && input.connections) {
    const config = structuredClone(input);
    config.connections = {
      jira: withUniqueIds(config.connections.jira, "jira"),
      confluence: withUniqueIds(config.connections.confluence, "confluence"),
      eva: withUniqueIds(config.connections.eva, "eva")
    };
    config.tms ||= { category: "none", provider: "none" };
    return config;
  }

  const jira = input.jira?.enabled
    ? [{
        ...input.jira,
        id: "jira-main",
        enableBugCreation: input.enableBugCreation === true,
        enableChecklistCommentPublication: input.enableChecklistCommentPublication === true
      }]
    : [];
  const confluence = input.confluence?.enabled
    ? [{ ...input.confluence, id: "confluence-main" }]
    : [];
  const oldProvider = input.tms?.provider || (jira.length ? "zephyr_scale" : "none");
  const tms = oldProvider === "qa_tools"
    ? { category: "other", provider: "qa_tools" }
    : oldProvider === "zephyr_scale" && jira.length
      ? { category: "zephyr", provider: "zephyr_scale", jiraConnectionId: jira[0].id }
      : { category: "none", provider: "none" };

  const config = {
    ...structuredClone(input),
    version: 2,
    connections: { jira, confluence, eva: [] },
    tms
  };
  delete config.jira;
  delete config.confluence;
  delete config.enableBugCreation;
  delete config.enableChecklistCommentPublication;
  return config;
}

export function connectionList(config, type) {
  return (config.connections?.[type] || []).filter((item) => item.enabled !== false);
}

export function findConnection(config, type, id) {
  const items = connectionList(config, type);
  if (!id) return items[0];
  return items.find((item) => item.id === id);
}

export function nextConnectionId(config, type) {
  const used = new Set((config.connections?.[type] || []).map((item) => item.id));
  let index = 1;
  while (used.has(`${type}-${index}`)) index += 1;
  return `${type}-${index}`;
}

export function serverName(type, id, total = 1) {
  const legacyMain = `${type}-main`;
  return total === 1 && id === legacyMain
    ? `testdocs_${type}`
    : `testdocs_${type}_${String(id).replace(/-/g, "_")}`;
}

export function sessionKey(type, id, total = 1) {
  return total === 1 && id === `${type}-main` ? type : `${type}-${id}`;
}

export function usesZephyr(config, jiraId) {
  return config.tms?.category === "zephyr" && config.tms?.jiraConnectionId === jiraId;
}

export function hasQaTools(config) {
  return config.tms?.category === "other" && config.tms?.provider === "qa_tools" && config.qaTools?.enabled;
}
