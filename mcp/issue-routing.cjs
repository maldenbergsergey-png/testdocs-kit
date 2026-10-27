function resolveIssueReference(value, entries) {
  let key = String(value || "");
  let candidates;
  if (/^https?:\/\//i.test(key)) {
    let input;
    try { input = new URL(key); } catch { throw new Error("INVALID_REFERENCE: неверная ссылка Jira."); }
    if (input.username || input.password) throw new Error("INVALID_REFERENCE: ссылка содержит учётные данные.");
    candidates = entries.filter((entry) => {
      const base = new URL(entry.url);
      const prefix = base.pathname.replace(/\/+$/, "");
      return input.origin === base.origin && input.pathname.startsWith(`${prefix}/`) &&
        /^\/(?:browse\/|rest\/api\/[23]\/issue\/)[A-Za-z][A-Za-z0-9_]*-\d+\/?$/.test(input.pathname.slice(prefix.length));
    });
    key = input.pathname.split("/").filter(Boolean).at(-1);
  } else {
    if (!/^[A-Za-z][A-Za-z0-9_]*-\d+$/.test(key)) throw new Error("INVALID_REFERENCE: нужен ключ задачи или полная ссылка Jira.");
    const project = key.slice(0, key.lastIndexOf("-")).toUpperCase();
    candidates = entries.filter((entry) => entry.projectKeys?.includes(project));
    if (!candidates.length && entries.length === 1) candidates = entries;
  }
  if (candidates.length !== 1) throw new Error("AMBIGUOUS_INSTANCE: передайте полную ссылку задачи или настройте однозначную привязку ключа проекта. Запросы не выполнялись.");
  return { connection: candidates[0], key };
}

function issueReference(value, current, connections = []) {
  const result = resolveIssueReference(value, connections.length ? connections : [current]);
  if (result.connection.id !== current.id) throw new Error("WRONG_CONNECTION: эта задача принадлежит другому Jira-подключению. Запросы не выполнялись.");
  return result.key;
}

module.exports = { issueReference, resolveIssueReference };
