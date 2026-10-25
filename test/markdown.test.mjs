import assert from "node:assert/strict";
import { test } from "node:test";
import { escapeHtml, renderMarkdownLite } from "../scripts/lib/markdown.mjs";

test("hard-wrapped lines become one paragraph", () => {
  const html = renderMarkdownLite("The format is the same on both sides, so the move\nis a rename plus a trim.");
  assert.equal(html, "<p>The format is the same on both sides, so the move is a rename plus a trim.</p>");
});

test("a blank line starts a new paragraph", () => {
  const html = renderMarkdownLite("One line.\n\nAnother line.");
  assert.equal(html, "<p>One line.</p>\n<p>Another line.</p>");
});

test("a run of lines inside a list item stays on one line", () => {
  const html = renderMarkdownLite("- first item\n- second item");
  assert.equal(html, "<ul><li>first item</li><li>second item</li></ul>");
});

test("paragraph and list do not consume each other", () => {
  const html = renderMarkdownLite("Intro line.\n\n- bullet\n\nAfter the list.");
  assert.equal(html, "<p>Intro line.</p>\n<ul><li>bullet</li></ul>\n<p>After the list.</p>");
});

test("fenced code keeps its newlines and is escaped", () => {
  const html = renderMarkdownLite("```\n{\n  \"type\": \"command\"\n}\n```");
  assert.equal(html, '<pre><code>{\n  &quot;type&quot;: &quot;command&quot;\n}</code></pre>');
});

test("headings shift one level so recipes nest under their section", () => {
  const html = renderMarkdownLite("## Run");
  assert.equal(html, "<h3>Run</h3>");
});

test("prose is escaped", () => {
  assert.equal(renderMarkdownLite("a < b & c"), "<p>a &lt; b &amp; c</p>");
});

test("escapeHtml handles a missing value", () => {
  assert.equal(escapeHtml(undefined), "");
});

test("backticked spans become code, not literal backticks", () => {
  assert.equal(renderMarkdownLite("Use `npm test` first."), "<p>Use <code>npm test</code> first.</p>");
});

test("code spans inside fenced code stay literal", () => {
  const html = renderMarkdownLite("```\n`not a span`\n```");
  assert.equal(html, "<pre><code>`not a span`</code></pre>");
});

test("a code span is escaped before it is wrapped", () => {
  assert.equal(renderMarkdownLite("`a < b`"), "<p><code>a &lt; b</code></p>");
});
