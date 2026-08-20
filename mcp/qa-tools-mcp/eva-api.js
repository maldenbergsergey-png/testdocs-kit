const { randomUUID } = require("node:crypto");

const DEFAULT_FIELDS = {
  CmfTask: [
    "id", "code", "name", "text", "project_id", "lists", "cmf_owner_id",
    "responsible", "cache_status_type", "priority", "deadline", "epic", "tags",
    "executors", "waiting_for", "parent_id", "parent_task_id", "fix_versions",
    "agile_story_points", "components", "logic_type", "status_id"
  ],
  CmfProject: [
    "id", "class_name", "code", "name", "cache_status_type", "cmf_owner_id",
    "workflow_id", "system", "executors", "cmfprojectadmins"
  ],
  CmfDocument: [
    "id", "class_name", "code", "name", "text", "project_id", "parent_id",
    "cache_status_type", "cmf_created_at", "cmf_modified_at"
  ],
  CmfComment: ["id", "class_name", "text", "cmf_author_id", "parent_id", "cmf_created_at", "log_level"]
};

const LIST_FIELDS = {
  CmfTask: ["id", "code", "name", "project_id", "cache_status_type", "priority", "deadline", "responsible_id", "epic_id", "parent_task_id", "status_id"],
  CmfProject: ["id", "class_name", "code", "name", "cache_status_type", "cmf_owner_id", "workflow_id", "system"],
  CmfDocument: ["id", "code", "name", "project_id", "parent_id", "cache_status_type", "cmf_created_at"],
  CmfComment: ["id", "text", "cmf_author_id", "parent_id", "cmf_created_at"]
};

const FILTER_OPERATORS = new Set(["==", "!=", ">", ">=", "<", "<=", "LIKE", "contains"]);

function apiUrl(baseUrl, method) {
  const normalized = new URL(baseUrl);
  normalized.search = "";
  normalized.hash = "";
  normalized.pathname = `${normalized.pathname.replace(/\/+$/, "")}/api/`.replace(/\/{2,}/g, "/");
  normalized.searchParams.set("m", method);
  return normalized;
}

async function rpcCall(baseUrl, token, method, payload = {}, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(apiUrl(baseUrl, method), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ jsonrpc: "2.2", method, callid: randomUUID(), ...payload }),
    signal: AbortSignal.timeout(30000)
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Eva API вернул не-JSON ответ (HTTP ${response.status}).`);
  }
  if (!response.ok) throw new Error(`Eva API HTTP ${response.status}: ${body?.error?.message || response.statusText}`);
  if (body.error) throw new Error(`Eva API RPC ${body.error.code || "ERROR"}: ${body.error.message || "неизвестная ошибка"}`);
  return body.result;
}

function filtersFrom(input, extra = []) {
  const filters = [];
  for (const item of input.filters || []) {
    if (!item || typeof item.field !== "string" || !FILTER_OPERATORS.has(item.operator)) {
      throw new Error("Каждый Eva-фильтр должен содержать field, допустимый operator и value.");
    }
    filters.push([item.field, item.operator, item.value]);
  }
  filters.push(...extra.filter(Boolean));
  return filters;
}

function listKwargs(entity, input, extraFilters = []) {
  const limit = Math.min(Math.max(Number(input.limit || 50), 1), 200);
  const offset = Math.max(Number(input.offset || 0), 0);
  const filters = filtersFrom(input, extraFilters);
  const kwargs = {
    fields: Array.isArray(input.fields) && input.fields.length ? input.fields : LIST_FIELDS[entity],
    slice: [offset, offset + limit],
    no_meta: true
  };
  if (filters.length === 1) kwargs.filter = filters[0];
  else if (filters.length > 1) kwargs.filter = filters;
  if (Array.isArray(input.order_by) && input.order_by.length) kwargs.order_by = input.order_by;
  if (input.include_archived === true) kwargs.include_archived = true;
  return kwargs;
}

function getKwargs(entity, input) {
  const field = input.code ? "code" : input.id ? "id" : null;
  const value = input.code || input.id;
  if (!field) throw new Error("Укажите code или id.");
  return {
    fields: Array.isArray(input.fields) && input.fields.length ? input.fields : DEFAULT_FIELDS[entity],
    filter: [field, "==", value],
    slice: [0, 1],
    no_meta: true
  };
}

const queryProperties = {
  fields: { type: "array", items: { type: "string" }, description: "Поля Eva, которые нужно вернуть" },
  filters: {
    type: "array",
    items: {
      type: "object",
      required: ["field", "operator", "value"],
      properties: {
        field: { type: "string" },
        operator: { type: "string", enum: [...FILTER_OPERATORS] },
        value: {}
      },
      additionalProperties: false
    }
  },
  order_by: { type: "array", items: { type: "string" } },
  offset: { type: "integer", minimum: 0 },
  limit: { type: "integer", minimum: 1, maximum: 200 },
  include_archived: { type: "boolean" }
};

function tool(name, description, properties, required = []) {
  return {
    name,
    description,
    inputSchema: { type: "object", properties, required, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true }
  };
}

const EVA_TOOLS = [
  tool("eva_task_get", "Получить задачу EvaProject по коду или ID", { code: { type: "string" }, id: { type: "string" }, fields: queryProperties.fields }),
  tool("eva_task_list", "Найти задачи EvaProject", {
    ...queryProperties,
    project_id: { type: "string" }, status_type: { type: "string" }, sprint_code: { type: "string" },
    responsible_id: { type: "string" }, logic_type_id: { type: "string" }, code: { type: "string" }
  }),
  tool("eva_project_get", "Получить проект Eva по коду или ID", { code: { type: "string" }, id: { type: "string" }, fields: queryProperties.fields }),
  tool("eva_project_list", "Получить список проектов Eva", { ...queryProperties, system: { type: "boolean" } }),
  tool("eva_document_get", "Получить документ EvaWiki по коду или ID", { code: { type: "string" }, id: { type: "string" }, fields: queryProperties.fields }),
  tool("eva_document_list", "Найти документы EvaWiki", { ...queryProperties, project_id: { type: "string" } }),
  tool("eva_document_page_tree", "Получить дерево страниц EvaWiki от указанного узла", { node_id: { type: "string" } }, ["node_id"]),
  tool("eva_comment_get", "Получить комментарий Eva по ID", { id: { type: "string" }, fields: queryProperties.fields }, ["id"]),
  tool("eva_comment_list", "Получить комментарии задачи Eva", {
    ...queryProperties, task_id: { type: "string" }, task_code: { type: "string" }, author_id: { type: "string" }
  })
];

async function callEvaTool(name, input, config, fetchImpl = globalThis.fetch) {
  const call = (method, payload) => rpcCall(config.baseUrl, config.token, method, payload, fetchImpl);
  switch (name) {
    case "eva_task_get": return call("CmfTask.get", { kwargs: getKwargs("CmfTask", input) });
    case "eva_task_list": return call("CmfTask.list", { kwargs: listKwargs("CmfTask", input, [
      input.project_id && ["project_id", "==", input.project_id], input.status_type && ["cache_status_type", "==", input.status_type],
      input.sprint_code && ["lists", "contains", input.sprint_code], input.responsible_id && ["responsible_id", "==", input.responsible_id],
      input.logic_type_id && ["logic_type_id", "==", input.logic_type_id], input.code && ["code", "==", input.code]
    ]) });
    case "eva_project_get": return call("CmfProject.get", { kwargs: getKwargs("CmfProject", input) });
    case "eva_project_list": return call("CmfProject.list", { kwargs: listKwargs("CmfProject", input, [
      typeof input.system === "boolean" && ["system", "==", input.system]
    ]) });
    case "eva_document_get": return call("CmfDocument.get", { kwargs: getKwargs("CmfDocument", input) });
    case "eva_document_list": return call("CmfDocument.list", { kwargs: listKwargs("CmfDocument", input, [
      input.project_id && ["project_id", "==", input.project_id]
    ]) });
    case "eva_document_page_tree": return call("CmfDocument.macros_page_tree_get", { kwargs: { node_id: input.node_id } });
    case "eva_comment_get": return call("CmfComment.get", { kwargs: getKwargs("CmfComment", input) });
    case "eva_comment_list": return call("CmfComment.list", { kwargs: listKwargs("CmfComment", input, [
      input.task_id && ["parent_id", "==", input.task_id], input.task_code && ["parent_id", "==", `Task:${input.task_code}`],
      input.author_id && ["cmf_author_id", "==", input.author_id]
    ]) });
    default: throw new Error(`Eva tool не поддерживается: ${name}`);
  }
}

module.exports = { EVA_TOOLS, apiUrl, callEvaTool, rpcCall };
