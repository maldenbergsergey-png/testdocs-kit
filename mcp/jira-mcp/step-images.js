const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

// Public Server/DC contract: kanoah/api.raml, attachments_get.example.
// https://support.smartbear.com/zephyr-scale-server/api-docs/v1/
function attachmentPath(testCaseKey, stepIndex) {
  if (!testCaseKey || (stepIndex !== undefined && (!Number.isInteger(stepIndex) || stepIndex < 0))) {
    throw new Error("testCaseKey and, when supplied, the exact non-negative API step index are required.");
  }
  return `/rest/atm/1.0/testcase/${encodeURIComponent(testCaseKey)}${stepIndex === undefined ? "" : `/step/${stepIndex}`}/attachments`;
}

async function readStepAttachments(input, request) {
  const result = await request(attachmentPath(input.testCaseKey, input.stepIndex));
  if (!Array.isArray(result)) throw new Error("Attachment inventory is unavailable; do not infer an empty list.");
  return result;
}

async function prepareImage(imagePath, filename) {
  if (!imagePath || !path.isAbsolute(imagePath)) throw new Error("imagePath must be an absolute local path.");
  filename = filename || path.basename(imagePath);
  if (!/^[\p{L}\p{N}_. ()-]+\.(?:png|jpe?g|gif|webp)$/iu.test(filename)) {
    throw new Error("Supply a safe image filename with a PNG, JPEG, GIF or WebP extension.");
  }
  const stat = await fs.stat(imagePath);
  if (!stat.isFile() || stat.size === 0 || stat.size > 25 * 1024 * 1024) {
    throw new Error("Image must be a non-empty file of at most 25 MiB.");
  }
  const data = await fs.readFile(imagePath);
  const mimeType = data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "image/png"
    : data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff ? "image/jpeg"
    : /^(GIF87a|GIF89a)$/.test(data.subarray(0, 6).toString("ascii")) ? "image/gif"
    : data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP" ? "image/webp"
    : null;
  const extensionMime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };
  if (!mimeType || extensionMime[path.extname(filename).slice(1).toLowerCase()] !== mimeType) {
    throw new Error("Image bytes do not match the supported filename type; no upload attempted.");
  }
  return { data, filename, mimeType, sha256: crypto.createHash("sha256").update(data).digest("hex") };
}

async function addStepImage(input, request, readCase) {
  if (input.confirmed !== true) throw new Error("Explicit image publication/correction intent is required.");
  attachmentPath(input.testCaseKey, input.stepIndex);
  if (!Number.isInteger(input.stepIndex) || !["description", "expectedResult"].includes(input.targetField) || !input.caption?.trim()) {
    throw new Error("Exact stepIndex, targetField (description or expectedResult) and caption are required.");
  }
  const width = input.thumbnailWidth ?? 320;
  if (!Number.isInteger(width) || width < 120 || width > 480) throw new Error("thumbnailWidth must be an integer from 120 to 480.");
  const endpoint = attachmentPath(input.testCaseKey);
  if (!input.expectedContentHash) throw new Error("Read the complete current case and supply its expectedContentHash first.");
  const file = await prepareImage(input.imagePath, input.filename);
  const current = await readCase({ testCaseKey: input.testCaseKey });
  if (!current?._testdocs?.complete || current._testdocs.contentHash !== input.expectedContentHash) {
    throw new Error("Complete case content is unavailable or changed; re-read the case and reconcile the image placement.");
  }
  const script = current.testScript;
  if (script?.type !== "STEP_BY_STEP" || !script.steps?.some((step) => step.index === input.stepIndex)) {
    throw new Error("The exact API step index was not found in the current case; do not infer it from the displayed row number.");
  }
  // PUT replaces the script. Preserve documented IDs and text verbatim; stop
  // before uploading if an unknown step shape or native binding could be lost.
  for (const step of script.steps) {
    if (!Number.isInteger(step.index) || !step.description || !step.expectedResult ||
        Object.keys(step).some((key) => !["id", "index", "description", "testData", "expectedResult"].includes(key))) {
      throw new Error("This script has unsupported step fields/calls; preserve it and prepare a preview placement proposal.");
    }
    const native = await readStepAttachments({ testCaseKey: input.testCaseKey, stepIndex: step.index }, request);
    if (native.length) throw new Error("Native step attachments exist. Script replacement preservation is unverified; prepare a preview proposal instead.");
  }
  const caseInput = { testCaseKey: input.testCaseKey };
  const before = await readStepAttachments(caseInput, request);
  if (before.some((entry) => entry.filename === file.filename)) {
    throw new Error("An attachment with this filename already exists at this step. Inspect it; do not duplicate, replace or delete it implicitly.");
  }
  const outcome = {
    testCaseKey: input.testCaseKey, stepIndex: input.stepIndex, targetField: input.targetField,
    filename: file.filename, sha256: file.sha256, status: "failed_or_uncertain"
  };
  try {
    const form = new FormData();
    form.append("file", new Blob([file.data], { type: file.mimeType }), file.filename);
    const saved = await request(endpoint, "POST", form, true);
    if (saved?.id === undefined || saved.id === null || String(saved.id).trim() === "") {
      throw new Error("Upload response did not return an attachment ID.");
    }
    outcome.id = String(saved.id);
    outcome.status = "uploaded_unverified";
    const after = await readStepAttachments(caseInput, request);
    const attachment = after.find((entry) => String(entry.id) === outcome.id);
    if (!attachment || attachment.filename !== file.filename || Number(attachment.filesize) !== file.data.length ||
        !/^https?:\/\//i.test(attachment.url || "") || before.some((entry) => String(entry.id) === outcome.id)) {
      throw new Error("Read-back did not confirm the uploaded source image.");
    }
    outcome.url = attachment.url;
    outcome.status = "source_uploaded";
    const latest = await readCase({ testCaseKey: input.testCaseKey });
    if (!latest?._testdocs?.complete || JSON.stringify(latest.testScript) !== JSON.stringify(script)) {
      throw new Error("Script changed after upload; preview was not inserted. Preserve the uploaded file and reconcile the current case.");
    }
    const escape = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const url = escape(attachment.url);
    const preview = `<br><a href="${url}"><img src="${url}" alt="${escape(input.caption)}" width="${width}" style="max-width:100%;height:auto;"></a>`;
    const finalSteps = script.steps.map((step) => step.index === input.stepIndex
      ? { ...step, [input.targetField]: step[input.targetField] + preview }
      : { ...step });
    outcome.status = "preview_write_uncertain";
    await request(`/rest/atm/1.0/testcase/${encodeURIComponent(input.testCaseKey)}`, "PUT", {
      testScript: { type: "STEP_BY_STEP", steps: finalSteps }
    });
    const savedCase = await readCase({ testCaseKey: input.testCaseKey });
    const fields = ["description", "testData", "expectedResult"];
    if (!savedCase?._testdocs?.complete || savedCase.testScript?.steps?.length !== finalSteps.length ||
        !finalSteps.every((step, index) => fields.every((field) => (savedCase.testScript.steps[index]?.[field] ?? "") === (step[field] ?? "")))) {
      throw new Error("Read-back did not confirm the preview and preserved text in the complete script.");
    }
    return { ...outcome, status: "preview_saved", displayVerified: false };
  } catch (error) {
    return { ...outcome, partialFailure: true, error: error.message, nextAction: "Inspect case attachments and the current step/field before retrying; do not repeat an uncertain upload or script write automatically." };
  }
}

module.exports = { readStepAttachments, addStepImage };
