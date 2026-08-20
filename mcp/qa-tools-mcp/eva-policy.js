const READ_TOOLS = new Set([
  "eva_task_get", "eva_task_list", "eva_task_count",
  "eva_project_get", "eva_project_list", "eva_project_count",
  "eva_comment_get", "eva_comment_list", "eva_comment_count",
  "eva_document_get", "eva_document_list", "eva_document_count", "eva_document_page_tree",
  "eva_person_get", "eva_person_list", "eva_person_count",
  "eva_epic_get", "eva_epic_list", "eva_epic_count",
  "eva_tasklink_get", "eva_tasklink_list", "eva_tasklink_count",
  "eva_statushistory_get", "eva_statushistory_list", "eva_statushistory_count",
  "eva_logic_type_get", "eva_logic_type_list", "eva_tag_list",
  "eva_sprint_get", "eva_sprint_list", "eva_release_get", "eva_release_list"
]);

function exposeEvaTool(tool) {
  return READ_TOOLS.has(tool?.name) ? tool : null;
}

module.exports = { exposeEvaTool, READ_TOOLS };
