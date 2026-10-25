import assert from "node:assert/strict";
import { test } from "node:test";
import { findLiteralMarkdown, stripFencedCode } from "../scripts/lib/prose.mjs";

test("bold markers in prose are reported", () => {
  const problems = findLiteralMarkdown("<p>This is **bold** text.</p>");
  assert.equal(problems.length, 1);
  assert.equal(problems[0].name, "bold markers");
});

test("a markdown link in prose is reported", () => {
  const problems = findLiteralMarkdown("<p>See [the docs](https://example.com).</p>");
  assert.equal(problems.length, 1);
  assert.equal(problems[0].name, "markdown link");
});

test("glob patterns inside fenced code are allowed", () => {
  const html = '<pre><code>paths:\n  - "src/**"\n</code></pre>';
  assert.deepEqual(findLiteralMarkdown(html), []);
});

test("double underscores in prose are allowed", () => {
  const problems = findLiteralMarkdown("<p>Write mcp__puppeteer__* to match a server.</p>");
  assert.deepEqual(problems, []);
});

test("a single asterisk is allowed", () => {
  assert.deepEqual(findLiteralMarkdown("<p>Use *.ts to match files.</p>"), []);
});

test("code is stripped but surrounding prose is still scanned", () => {
  const html = "<pre><code>src/**</code></pre><p>and **this**</p>";
  const problems = findLiteralMarkdown(html);
  assert.equal(problems.length, 1);
});

test("stripFencedCode removes every block", () => {
  const html = "<pre>a</pre><p>keep</p><pre>b</pre>";
  assert.equal(stripFencedCode(html), "<p>keep</p>");
});

test("a stray bold marker is still reported", () => {
  assert.equal(findLiteralMarkdown("<p>unclosed ** here</p>").length, 1);
});

test("the path in a reported problem is a readable snippet", () => {
  const problems = findLiteralMarkdown("<p>before **after</p>");
  assert.match(problems[0].snippet, /before/);
});
