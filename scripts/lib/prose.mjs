// Finds markdown syntax that survived into the rendered page.
//
// The renderer supports headings, fenced code, bullets, paragraphs, and inline
// code. Anything else — bold, links — passes through as literal characters and
// reads as a bug. The YAML parser fails loudly on bad data; this is the
// equivalent guard for bad presentation.
//
// Fenced code is stripped before scanning, because recipe files legitimately
// contain sequences like the src/** glob in a paths: frontmatter.

export const CHECKS = [
  // The span alternative comes first so **bold** reports once, not twice for
  // its two delimiters. The bare alternative catches an unclosed marker.
  { name: "bold markers", pattern: /\*\*[^*]+\*\*|\*\*/ },
  { name: "markdown link", pattern: /\]\([^)]*\)/ },
];

export function stripFencedCode(html) {
  return html.replace(/<pre[\s\S]*?<\/pre>/g, "");
}

export function findLiteralMarkdown(html, limit = 20) {
  const prose = stripFencedCode(html);
  const problems = [];

  for (const check of CHECKS) {
    const pattern = new RegExp(check.pattern.source, "g");
    let match;
    while ((match = pattern.exec(prose)) !== null) {
      const start = Math.max(0, match.index - 40);
      const end = Math.min(prose.length, match.index + match[0].length + 40);
      problems.push({
        name: check.name,
        snippet: prose.slice(start, end).replace(/\s+/g, " ").trim(),
      });
      if (problems.length >= limit) return problems;
    }
  }

  return problems;
}
