#!/usr/bin/env node
// Fails when the renderer left markdown syntax unrendered in a generated page.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { findLiteralMarkdown } from "./lib/prose.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TARGETS = ["dist/index.html", "dist/gaps.html"];

const problems = [];
let scanned = 0;

for (const target of TARGETS) {
  const path = join(ROOT, target);
  if (!existsSync(path)) {
    console.error(`lint-prose: ${target} is missing — run npm run build first`);
    process.exit(1);
  }
  scanned++;
  for (const problem of findLiteralMarkdown(readFileSync(path, "utf8"))) {
    problems.push(`${target}: ${problem.name} in prose: …${problem.snippet}…`);
  }
}

if (problems.length > 0) {
  console.error("lint-prose: markdown reached the page unrendered:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`lint-prose: clean (${scanned} pages)`);
