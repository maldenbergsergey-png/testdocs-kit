#!/usr/bin/env node
// Validates an independently produced decision record. Does not implement a keyword router or call a model.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expected = JSON.parse(fs.readFileSync(path.join(root, "evals", "routing.json"), "utf8"));
const [argument, output] = process.argv.slice(2);
if (argument === "--prepare" && output) {
  fs.writeFileSync(output, `${JSON.stringify(expected.map(({ id, prompt }) => ({ id, prompt })), null, 2)}\n`);
  console.log(`Blind evaluation inputs: ${output}`);
} else if (argument) {
  const actual = JSON.parse(fs.readFileSync(argument, "utf8"));
  const failures = [];
  const ids = new Set();
  for (const row of actual) {
    if (ids.has(row.id)) failures.push(`${row.id}: duplicate result`);
    ids.add(row.id);
    if (!expected.some((item) => item.id === row.id)) failures.push(`${row.id}: unknown result`);
  }
  for (const item of expected) {
    const observed = actual.find((row) => row.id === item.id);
    if (!observed) { failures.push(`${item.id}: missing result`); continue; }
    for (const key of ["skill", "artifact", "collect"]) {
      if (observed[key] !== item[key]) failures.push(`${item.id}: ${key}: expected ${item[key]}, observed ${observed[key]}`);
    }
  }
  if (failures.length) {
    console.error(failures.join("\n")); process.exitCode = 1;
  } else console.log(`${expected.length} independent routing decisions match the expected contract. This checks a recorded evaluation, not a live model run.`);
} else {
  console.error("Usage: check-routing-eval.mjs --prepare /tmp/prompts.json | /tmp/observed.json");
  process.exitCode = 1;
}
