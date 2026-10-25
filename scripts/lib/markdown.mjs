// A deliberately small markdown renderer, sized to the recipe READMEs.
//
// Supports: ATX headings, fenced code, "- " bullets, and paragraphs.
// A paragraph is a run of consecutive non-blank lines, joined with a space.
// Source files are hard-wrapped for editors; the output should not be.

export const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Escape first, then turn `code spans` into <code>. Escaping leaves backticks
// untouched, so the two steps cannot interfere.
const renderInline = (text) =>
  escapeHtml(text).replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);

export function renderMarkdownLite(text) {
  const out = [];
  let fenced = false;
  let code = [];
  let bullets = [];
  let paragraph = [];

  const flushBullets = () => {
    if (bullets.length > 0) {
      out.push(`<ul>${bullets.join("")}</ul>`);
      bullets = [];
    }
  };

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      out.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };

  const flushAll = () => {
    flushParagraph();
    flushBullets();
  };

  for (const line of text.split("\n")) {
    if (line.startsWith("```")) {
      if (fenced) {
        out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = [];
        fenced = false;
      } else {
        flushAll();
        fenced = true;
      }
      continue;
    }

    if (fenced) {
      code.push(line);
      continue;
    }

    if (line.startsWith("#")) {
      flushAll();
      const depth = Math.min((line.match(/^#+/) ?? ["#"])[0].length + 1, 6);
      out.push(`<h${depth}>${renderInline(line.replace(/^#+\s*/, ""))}</h${depth}>`);
      continue;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      bullets.push(`<li>${renderInline(line.slice(2))}</li>`);
      continue;
    }

    if (line.trim() === "") {
      flushAll();
      continue;
    }

    flushBullets();
    paragraph.push(line.trim());
  }

  flushAll();
  if (fenced && code.length > 0) out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  return out.join("\n");
}
