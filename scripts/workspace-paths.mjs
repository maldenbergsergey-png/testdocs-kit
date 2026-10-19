import crypto from "node:crypto";

// Keep existing task paths stable; hash the exact value to distinguish readable slug collisions.
export function workspaceSegment(value, label) {
  const source = String(value || "").trim().normalize("NFKC");
  if (!source) throw new Error(`Укажите ${label}.`);
  const readable = source.toLowerCase().replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "").slice(0, 72);
  const suffix = crypto.createHash("sha256").update(source).digest("hex").slice(0, 8);
  return `${readable || label}-${suffix}`;
}
