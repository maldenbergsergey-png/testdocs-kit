const fs = require("node:fs/promises");
const path = require("node:path");

async function prepareBugAttachments(input, request, apiVersion) {
  const attachments = input.attachments || [];
  if (!Array.isArray(attachments) || attachments.length > 20) throw new Error("At most 20 supplied attachments are supported.");
  if (input.descriptionFormat && !["plain", "wiki"].includes(input.descriptionFormat)) throw new Error("Unsupported descriptionFormat.");
  if (String(apiVersion) === "3" && input.descriptionFormat === "wiki") throw new Error("Cloud Description requires ADF, not Wiki markup.");
  if (!attachments.length) return [];
  const names = new Set();
  const files = [];
  const metadata = await request(`/rest/api/${apiVersion}/attachment/meta`);
  if (metadata.enabled !== true) throw new Error("Jira attachments are disabled or unavailable; no bug was created.");
  for (const entry of attachments) {
    if (!entry.path || !path.isAbsolute(entry.path)) throw new Error("Attachment path must be absolute.");
    const filename = entry.filename || path.basename(entry.path);
    if (!/^[\p{L}\p{N}_. ()-]+$/u.test(filename) || filename === "." || filename === ".." || names.has(filename)) {
      throw new Error("Supply safe, unique attachment filenames before creating the bug.");
    }
    if (!/^[\w.+-]+\/[\w.+-]+$/.test(entry.mimeType || "")) throw new Error("Attachment mimeType is required.");
    const stat = await fs.stat(entry.path);
    const limit = Math.min(Number(metadata.uploadLimit) || 10 * 1024 * 1024, 25 * 1024 * 1024);
    if (!stat.isFile() || stat.size > limit) throw new Error(`Attachment ${filename} is not a file or exceeds the upload limit (${limit} bytes).`);
    files.push({ filename, mimeType: entry.mimeType, data: await fs.readFile(entry.path) });
    names.add(filename);
  }
  return files;
}

async function finishBugAttachments(input, result, files, request, apiVersion, toAdf) {
  if (!files.length) return result;
  const outcomes = files.map(({ filename }) => ({ filename, status: "pending" }));
  result._testdocs.attachments = outcomes;
  result._testdocs.previews = "pending";
  const uploaded = [];
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    try {
      const form = new FormData();
      form.append("file", new Blob([file.data], { type: file.mimeType }), file.filename);
      const response = await request(`/rest/api/${apiVersion}/issue/${encodeURIComponent(result.key)}/attachments`, "POST", form, true);
      const saved = Array.isArray(response) && response.length === 1 ? response[0] : null;
      if (!saved?.id || !saved?.content || saved.filename !== file.filename) throw new Error("Upload response did not identify the expected attachment.");
      outcomes[index] = { filename: saved.filename, id: String(saved.id), url: saved.content, status: "uploaded" };
      uploaded.push({ ...saved, mimeType: saved.mimeType || file.mimeType });
    } catch (error) {
      outcomes[index].status = "failed_or_uncertain";
      outcomes[index].error = error.message;
      result._testdocs.partialFailure = true;
      result._testdocs.previews = "not_inserted";
      return result;
    }
  }
  try {
    // Re-read before the narrow update; never replace a concurrent Description edit.
    const issuePath = `/rest/api/${apiVersion}/issue/${encodeURIComponent(result.key)}`;
    const issue = await request(issuePath);
    const cloud = String(apiVersion) === "3";
    const expected = input.description ? (cloud ? toAdf(input.description) : input.description) : null;
    if (JSON.stringify(issue.fields?.description ?? null) !== JSON.stringify(expected)) {
      throw new Error("Description changed or could not be verified; preview update was not attempted.");
    }
    let description;
    if (cloud) {
      description = expected || toAdf("");
      description.content.push({ type: "paragraph", content: [{ type: "text", text: "Материалы:" }] });
      for (const file of uploaded) {
        description.content.push({ type: "paragraph", content: [{ type: "text", text: file.filename, marks: [{ type: "link", attrs: { href: file.content } }] }] });
      }
    } else {
      const wiki = input.descriptionFormat === "wiki";
      const lines = uploaded.map((file) => wiki
        ? (file.mimeType.startsWith("image/") ? `${file.filename}\n!${file.filename}|thumbnail!` : `[^${file.filename}]`)
        : `${file.filename}: ${file.content}`);
      description = [input.description, "Материалы:", ...lines].filter(Boolean).join("\n\n");
    }
    await request(issuePath, "PUT", { fields: { description } });
    const saved = await request(issuePath);
    if (JSON.stringify(saved.fields?.description) !== JSON.stringify(description) ||
        !uploaded.every((file) => saved.fields?.attachment?.some((item) => String(item.id) === String(file.id)))) {
      throw new Error("Saved Description or attachment inventory could not be verified.");
    }
    result._testdocs.previews = !cloud && input.descriptionFormat === "wiki" ? "wiki_thumbnails_inserted" : "links_only";
    if (result._testdocs.previews === "links_only" && uploaded.some((file) => file.mimeType.startsWith("image/"))) {
      result._testdocs.previewLimitation = "Images were uploaded and linked; inline previews require a supported media connector or Server/DC Wiki renderer.";
    }
  } catch (error) {
    result._testdocs.partialFailure = true;
    result._testdocs.previews = "failed_or_unverified";
    result._testdocs.previewError = error.message;
  }
  return result;
}

module.exports = { prepareBugAttachments, finishBugAttachments };
