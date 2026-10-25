#!/usr/bin/env node
// Renders index.html and gaps.html from comparison.yaml.
//
// Two gates run before anything is written:
//   source gate     every construct cites a URL for both products
//   staleness gate  every row carries a real verified date
//
// A row that fails either one stops the build. An unsourced claim is a defect,
// not a rough edge.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { escapeHtml, renderMarkdownLite } from "./lib/markdown.mjs";
import { loadYaml } from "./lib/yaml.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CHECK_ONLY = process.argv.includes("--check");
const MATCHES = new Set(["exact", "partial", "none"]);
const SURFACES = new Set(["yes", "no", "unknown"]);

const errors = [];

function expect(condition, message) {
  if (!condition) errors.push(message);
}

function expectDate(value, where) {
  expect(
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value),
    `${where}: verified must be a quoted YYYY-MM-DD date`,
  );
  const time = Date.parse(`${value}T00:00:00Z`);
  expect(!Number.isNaN(time), `${where}: verified is not a real date`);
}

function validate(document) {
  expect(document && typeof document === "object", "document root must be a map");

  const meta = document?.meta ?? {};
  expect(typeof meta.title === "string" && meta.title !== "", "meta.title is required");
  expectDate(meta.verified, "meta");

  const staleAfterDays = Number(meta.stale_after_days ?? 120);
  expect(
    Number.isFinite(staleAfterDays) && staleAfterDays > 0,
    "meta.stale_after_days must be a positive number",
  );

  const constructs = document?.constructs ?? [];
  expect(Array.isArray(constructs) && constructs.length > 0, "at least one construct is required");

  const seen = new Set();
  for (const [index, construct] of constructs.entries()) {
    const at = `constructs[${index}]`;
    expect(
      typeof construct.id === "string" && /^[a-z0-9-]+$/.test(construct.id),
      `${at}: id must be lowercase kebab-case`,
    );
    expect(!seen.has(construct.id), `${at}: duplicate id "${construct.id}"`);
    seen.add(construct.id);

    expect(typeof construct.name === "string" && construct.name !== "", `${at}: name is required`);
    expect(
      MATCHES.has(construct.equivalence),
      `${at}: equivalence must be exact, partial, or none`,
    );

    for (const side of ["claude_code", "cline"]) {
      const block = construct[side] ?? {};
      expect(
        typeof block.where === "string" && block.where !== "",
        `${at}: ${side}.where is required`,
      );
      expect(
        typeof block.mechanism === "string" && block.mechanism !== "",
        `${at}: ${side}.mechanism is required`,
      );
      const url = construct.source?.[side];
      expect(
        typeof url === "string" && /^https?:\/\//.test(url),
        `${at}: source.${side} must be an http(s) URL`,
      );
    }

    expectDate(construct.verified, at);

    for (const [surface, value] of Object.entries(construct.surfaces ?? {})) {
      expect(SURFACES.has(value), `${at}: surfaces.${surface} must be yes, no, or unknown`);
    }
  }

  const gaps = document?.gaps ?? [];
  const gapIds = new Set();
  for (const [index, gap] of gaps.entries()) {
    const at = `gaps[${index}]`;
    expect(
      typeof gap.id === "string" && /^[a-z0-9-]+$/.test(gap.id),
      `${at}: id must be lowercase kebab-case`,
    );
    expect(!gapIds.has(gap.id), `${at}: duplicate id "${gap.id}"`);
    gapIds.add(gap.id);

    expect(typeof gap.title === "string" && gap.title !== "", `${at}: title is required`);
    expect(typeof gap.detail === "string" && gap.detail !== "", `${at}: detail is required`);

    const urls = Object.values(gap.source ?? {}).filter(
      (url) => typeof url === "string" && url !== "",
    );
    expect(urls.length > 0, `${at}: at least one source URL is required`);
    for (const url of urls) {
      expect(/^https?:\/\//.test(url), `${at}: source URLs must start with http`);
    }

    expectDate(gap.verified, at);
  }

  return { meta, constructs, gaps, staleAfterDays };
}

const esc = escapeHtml;

function daysSince(dateString) {
  const then = Date.parse(`${dateString}T00:00:00Z`);
  return Math.floor((Date.now() - then) / 86_400_000);
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

// Reads a recipe tree straight off disk. The page cannot drift from the files
// because the files are what the page contains.
function readTree(dir, base) {
  return walk(dir)
    .map((full) => ({
      name: relative(base, full).split(sep).join("/"),
      content: readFileSync(full, "utf8"),
    }))
    .filter((file) => file.content.length <= 40_000);
}

function loadRecipes() {
  const dir = join(ROOT, "recipes");
  if (!existsSync(dir)) return [];

  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const base = join(dir, entry.name);
      const readmePath = join(base, "README.md");
      const readme = existsSync(readmePath) ? readFileSync(readmePath, "utf8") : "";
      const heading = readme.split("\n").find((line) => line.startsWith("# "));
      return {
        slug: entry.name,
        title: heading ? heading.slice(2).trim() : entry.name,
        body: readme
          .split("\n")
          .filter((line) => !line.startsWith("# "))
          .join("\n")
          .trim(),
        before: readTree(join(base, "before"), base),
        after: readTree(join(base, "after"), base),
      };
    });
}

const badge = (match, label) => `<span class="badge ${match}">${esc(label ?? match)}</span>`;

function staleBadge(verified, staleAfterDays) {
  const days = daysSince(verified);
  return days > staleAfterDays ? `<span class="badge stale">stale ${days}d</span>` : "";
}

function renderFile(file) {
  const content = file.content.replace(/\n$/, "");
  return `<p class="filename">${esc(file.name)}</p><pre><code>${esc(content)}</code></pre>`;
}

function page({ title, description, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
<main class="wrap">
${body}
<footer>
Generated from <code>comparison.yaml</code> by <code>scripts/build.mjs</code>.
Edit the data, not this file.
</footer>
</main>
</body>
</html>
`;
}

function renderIndex({ meta, constructs, gaps, staleAfterDays }, recipes) {
  const counts = { exact: 0, partial: 0, none: 0 };
  for (const construct of constructs) counts[construct.equivalence] += 1;

  const summaryRows = constructs
    .map(
      (construct) => `<tr>
      <td><a href="#${construct.id}"><strong>${esc(construct.name)}</strong></a></td>
      <td>${esc(construct.claude_code.where)}</td>
      <td>${esc(construct.cline.where)}</td>
      <td>${badge(construct.equivalence)}</td>
    </tr>`,
    )
    .join("\n");

  const cards = constructs
    .map(
      (construct) => `<article class="card" id="${construct.id}">
      <h2>${esc(construct.name)} ${badge(construct.equivalence)} ${staleBadge(
        construct.verified,
        staleAfterDays,
      )}</h2>
      <div class="grid-2">
        <div>
          <h3>Claude Code</h3>
          <p class="where">${esc(construct.claude_code.where)}</p>
          <p>${esc(construct.claude_code.mechanism)}</p>
        </div>
        <div>
          <h3>Cline</h3>
          <p class="where">${esc(construct.cline.where)}</p>
          <p>${esc(construct.cline.mechanism)}</p>
        </div>
      </div>
      ${construct.note ? `<p class="note">${esc(construct.note)}</p>` : ""}
      <div class="sources">
        <a href="${esc(construct.source.claude_code)}">Claude Code source</a>
        <a href="${esc(construct.source.cline)}">Cline source</a>
        <span>verified ${esc(construct.verified)}</span>
      </div>
    </article>`,
    )
    .join("\n");

  const body = `<header>
  <h1>${esc(meta.title)}</h1>
  <p class="lede">${esc(meta.subtitle)}</p>
  <div class="meta">
    <span><strong>${constructs.length}</strong> constructs</span>
    <span><strong>${counts.exact}</strong> exact</span>
    <span><strong>${counts.partial}</strong> partial</span>
    <span><strong>${counts.none}</strong> none</span>
    <span><strong>${gaps.length}</strong> gaps</span>
    <span>verified <strong>${esc(meta.verified)}</strong></span>
  </div>
</header>

<p>A row marked ${badge("none")} has no supported equivalent, and the note names the
workaround. A row past its staleness window carries a dashed badge, which means
re-check it before you rely on it.</p>

<p><a href="gaps.html">The gaps page</a> is the short list of what does not port. Read it
before you plan a move, not after.</p>

<h2>The map</h2>
<table>
  <thead>
    <tr><th>Construct</th><th>Claude Code</th><th>Cline</th><th>Match</th></tr>
  </thead>
  <tbody>
${summaryRows}
  </tbody>
</table>

<h2>In detail</h2>
${cards}

<h2>Recipes</h2>
<p>Each recipe is a real <code>before/</code> and <code>after/</code> tree. The files shown
here are read from disk at build time, so they cannot drift from what you would copy.</p>
${renderRecipes(recipes)}`;

  return page({ title: meta.title, description: meta.subtitle, body });
}

function renderRecipes(recipes) {
  if (recipes.length === 0) return "";

  return recipes
    .map(
      (recipe) => `<section class="recipe" id="recipe-${recipe.slug}">
    <h3>${esc(recipe.title)}</h3>
    ${renderMarkdownLite(recipe.body)}
    <div class="grid-2">
      <div>
        <h3>Before</h3>
        ${recipe.before.map(renderFile).join("\n") || "<p>No files.</p>"}
      </div>
      <div>
        <h3>After</h3>
        ${recipe.after.map(renderFile).join("\n") || "<p>No files.</p>"}
      </div>
    </div>
  </section>`,
    )
    .join("\n");
}

function renderGaps({ meta, constructs, gaps, staleAfterDays }) {
  const items = gaps
    .map(
      (gap) => `<article class="card" id="${gap.id}">
      <h2>${esc(gap.title)} ${staleBadge(gap.verified, staleAfterDays)}</h2>
      <p>${esc(gap.detail)}</p>
      <div class="sources">
        ${gap.source?.claude_code ? `<a href="${esc(gap.source.claude_code)}">Claude Code source</a>` : ""}
        ${gap.source?.cline ? `<a href="${esc(gap.source.cline)}">Cline source</a>` : ""}
        <span>verified ${esc(gap.verified)}</span>
      </div>
    </article>`,
    )
    .join("\n");

  const surfaced = constructs.filter(
    (construct) => construct.surfaces && Object.keys(construct.surfaces).length > 0,
  );

  const surfaceRows = surfaced
    .map(
      (construct) => `<tr>
      <td><a href="index.html#${construct.id}">${esc(construct.name)}</a></td>
      <td>${esc(construct.surfaces.vscode ?? "unknown")}</td>
      <td>${esc(construct.surfaces.desktop ?? "unknown")}</td>
      <td>${esc(construct.surfaces.cli ?? "unknown")}</td>
      <td>${esc(construct.surfaces.sdk ?? "unknown")}</td>
    </tr>`,
    )
    .join("\n");

  const body = `<header>
  <h1>What does not port</h1>
  <p class="lede">The short list of constructs with no supported equivalent, or with no
  equivalent on the surface you use.</p>
  <div class="meta">
    <span><strong>${gaps.length}</strong> gaps</span>
    <span>verified <strong>${esc(meta.verified)}</strong></span>
  </div>
</header>

<p>Read this before planning a move. Every item here is either an absence or a
coarser mechanism, and each one changes what the migration costs.</p>

<h2>Where each construct exists</h2>
<p>Only rows with a documented surface restriction appear. An ${badge("unknown")} cell
means the docs do not say, which is not the same as no.</p>
<table>
  <thead>
    <tr><th>Construct</th><th>VS Code</th><th>Desktop</th><th>CLI</th><th>SDK</th></tr>
  </thead>
  <tbody>
${surfaceRows || '<tr><td colspan="5">No documented surface restrictions.</td></tr>'}
  </tbody>
</table>

<h2>The gaps</h2>
${items}

<p><a href="index.html">Back to the map</a></p>`;

  return page({
    title: `What does not port — ${meta.title}`,
    description: "Constructs with no supported Cline equivalent.",
    body,
  });
}

let document;
try {
  document = loadYaml(join(ROOT, "comparison.yaml"));
} catch (error) {
  console.error(`comparison.yaml could not be parsed:\n  ${error.message}`);
  process.exit(1);
}

const data = validate(document);

if (errors.length > 0) {
  console.error(`build failed with ${errors.length} problem(s):`);
  for (const message of errors) console.error(`  - ${message}`);
  process.exit(1);
}

if (CHECK_ONLY) {
  console.log(
    `ok: ${data.constructs.length} constructs and ${data.gaps.length} gaps, all sourced`,
  );
  process.exit(0);
}

const recipes = loadRecipes();

// Pages serves an artifact built in CI, so output goes to dist/ and never into
// the working tree. Rebuilding is not a commit.
const out = join(ROOT, "dist");
mkdirSync(join(out, "assets"), { recursive: true });
writeFileSync(join(out, "index.html"), renderIndex(data, recipes));
writeFileSync(join(out, "gaps.html"), renderGaps(data));
copyFileSync(join(ROOT, "assets/style.css"), join(out, "assets/style.css"));

console.log(`wrote dist/index.html — ${data.constructs.length} constructs, ${recipes.length} recipes`);
console.log(`wrote dist/gaps.html — ${data.gaps.length} gaps`);
console.log("copied dist/assets/style.css");



