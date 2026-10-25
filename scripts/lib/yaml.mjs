// A minimal YAML subset. Not a YAML implementation, and not trying to be.
//
// Supported: nested maps, block lists, inline lists, quoted scalars,
// integers, booleans, null.
// Unsupported: tabs, block scalars, anchors/aliases, inline maps,
// multi-document files.
//
// Anything unsupported throws a YamlError naming the line. That is the point:
// a parse problem must never become a silently wrong page.

import { readFileSync } from "node:fs";

export class YamlError extends Error {
  constructor(source, line, message) {
    super(`${source}:${line}: ${message}`);
    this.name = "YamlError";
    this.source = source;
    this.line = line;
  }
}

export function parseYaml(text, source = "<input>") {
  const rows = [];
  let sourceLine = 0;

  for (const raw of text.split("\n")) {
    sourceLine++;
    if (raw.trim() === "") continue;
    if (/^[ ]*#/.test(raw)) continue;
    if (raw.includes("\t")) {
      throw new YamlError(source, sourceLine, "tabs are not allowed; indent with spaces");
    }
    const indent = raw.match(/^ */)[0].length;
    const body = raw.slice(indent).replace(/[ ]+$/, "");
    rows.push({ indent, body, line: sourceLine });
  }

  let pos = 0;
  const peek = () => rows[pos];

  function parseBlock(indent) {
    return isListItem(peek().body) ? parseList(indent) : parseMap(indent);
  }

  function parseMap(indent) {
    const out = {};
    while (pos < rows.length) {
      const row = rows[pos];
      if (row.indent !== indent) break;
      if (isListItem(row.body)) break;
      const separator = findKeySeparator(row.body);
      if (separator < 0) {
        throw new YamlError(source, row.line, `expected "key: value", got: ${row.body}`);
      }
      const key = row.body.slice(0, separator).trim();
      if (key === "") throw new YamlError(source, row.line, "empty key");
      if (Object.hasOwn(out, key)) {
        throw new YamlError(source, row.line, `duplicate key "${key}"`);
      }
      const value = row.body.slice(separator + 1).trim();
      pos++;
      assign(out, key, value, row.line, indent);
    }
    return out;
  }

  function parseList(indent) {
    const out = [];
    while (pos < rows.length) {
      const row = rows[pos];
      if (row.indent < indent) break;
      if (row.indent > indent) {
        throw new YamlError(source, row.line, "unexpected indentation inside a list");
      }
      if (!isListItem(row.body)) break;

      const rest = row.body === "-" ? "" : row.body.slice(2).trim();
      const line = row.line;
      pos++;

      if (rest === "") {
        out.push(pos < rows.length && rows[pos].indent > indent ? parseBlock(rows[pos].indent) : null);
        continue;
      }

      const separator = findKeySeparator(rest);
      if (separator < 0) {
        out.push(parseScalar(rest, line));
        if (pos < rows.length && rows[pos].indent > indent) {
          throw new YamlError(source, rows[pos].line, "nested block under a scalar list item");
        }
        continue;
      }

      const item = {};
      const key = rest.slice(0, separator).trim();
      const value = rest.slice(separator + 1).trim();
      item[key] = null;
      assign(item, key, value, line, indent);

      if (pos < rows.length && rows[pos].indent > indent) {
        const child = parseMap(rows[pos].indent);
        for (const [childKey, childValue] of Object.entries(child)) {
          if (Object.hasOwn(item, childKey)) {
            throw new YamlError(source, line, `duplicate key "${childKey}"`);
          }
          item[childKey] = childValue;
        }
      }
      out.push(item);
    }
    return out;
  }

  function assign(target, key, value, line, indent) {
    if (value !== "") {
      target[key] = parseScalar(value, line);
      return;
    }
    if (pos < rows.length && rows[pos].indent > indent) {
      target[key] = parseBlock(rows[pos].indent);
      return;
    }
    if (pos < rows.length && rows[pos].indent === indent && isListItem(rows[pos].body)) {
      target[key] = parseList(indent);
      return;
    }
    target[key] = null;
  }

  function parseScalar(value, line) {
    const v = value.trim();
    if (v === "") return null;

    if (v.startsWith('"')) {
      if (v.length < 2 || !v.endsWith('"')) {
        throw new YamlError(source, line, "unterminated double-quoted string");
      }
      try {
        return JSON.parse(v);
      } catch {
        return v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      }
    }

    if (v.startsWith("'")) {
      if (v.length < 2 || !v.endsWith("'")) {
        throw new YamlError(source, line, "unterminated single-quoted string");
      }
      return v.slice(1, -1).replace(/''/g, "'");
    }

    if (v.startsWith("|") || v.startsWith(">")) {
      throw new YamlError(source, line, "block scalars are not supported; use a quoted string");
    }
    if (v.startsWith("&") || v.startsWith("*")) {
      throw new YamlError(source, line, "anchors and aliases are not supported");
    }
    if (v.startsWith("{")) {
      throw new YamlError(source, line, "inline maps are not supported; use a nested block");
    }
    if (v.startsWith("[")) {
      if (!v.endsWith("]")) {
        throw new YamlError(source, line, "inline list must close on the same line");
      }
      const inner = v.slice(1, -1).trim();
      return inner === "" ? [] : splitInline(inner).map((part) => parseScalar(part, line));
    }

    if (v === "null" || v === "~") return null;
    if (v === "true") return true;
    if (v === "false") return false;
    if (/^-?\d+$/.test(v)) return Number(v);
    if (v.startsWith("%")) throw new YamlError(source, line, "directives are not supported");
    if (v.includes(": ")) {
      throw new YamlError(source, line, 'unquoted value contains ": " — quote the value');
    }
    return v;
  }

  function splitInline(text) {
    const parts = [];
    let current = "";
    let quote = null;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quote) {
        current += ch;
        if (ch === "\\" && quote === '"') {
          current += text[++i] ?? "";
        } else if (ch === quote) {
          quote = null;
        }
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        current += ch;
        continue;
      }
      if (ch === ",") {
        parts.push(current.trim());
        current = "";
        continue;
      }
      current += ch;
    }
    if (quote) throw new YamlError(source, 0, "unterminated quote in inline list");
    parts.push(current.trim());
    return parts.filter((part) => part !== "");
  }

  if (rows.length === 0) return {};
  if (peek().indent !== 0) {
    throw new YamlError(source, peek().line, "document must start at column 0");
  }
  const document = parseBlock(0);
  if (pos < rows.length) {
    throw new YamlError(source, rows[pos].line, "unexpected content after the document root");
  }
  return document;
}

export function loadYaml(path) {
  return parseYaml(readFileSync(path, "utf8"), path);
}

function isListItem(body) {
  return body === "-" || body.startsWith("- ");
}

function findKeySeparator(text) {
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\" && quote === '"') {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === ":" && (i + 1 === text.length || text[i + 1] === " ")) return i;
  }
  return -1;
}
