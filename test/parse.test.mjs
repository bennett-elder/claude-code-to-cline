import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { parseYaml, YamlError } from "../scripts/lib/yaml.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

test("reads nested maps and block lists", () => {
  const document = parseYaml(`
meta:
  title: "A title"
counts:
  - id: "one"
    value: 1
  - id: "two"
    value: 2
`);
  assert.deepEqual(document, {
    meta: { title: "A title" },
    counts: [
      { id: "one", value: 1 },
      { id: "two", value: 2 },
    ],
  });
});

test("reads inline lists and scalars", () => {
  const document = parseYaml(`a: [1, "two", true, null]`);
  assert.deepEqual(document, { a: [1, "two", true, null] });
});

test("a colon inside a quoted value is not a key separator", () => {
  const document = parseYaml(`url: "https://example.com/a:b"\nnote: "key: value"`);
  assert.equal(document.url, "https://example.com/a:b");
  assert.equal(document.note, "key: value");
});

test("single quotes are read literally", () => {
  const document = parseYaml(`a: 'it''s here'`);
  assert.equal(document.a, "it's here");
});

test("rejects tabs", () => {
  assert.throws(() => parseYaml("a:\n\tb: 1"), YamlError);
});

test("rejects block scalars", () => {
  assert.throws(() => parseYaml("a: |\n  text"), /block scalars are not supported/);
});

test("rejects an unquoted value containing a colon and a space", () => {
  assert.throws(() => parseYaml("a: key: value"), /quote the value/);
});

test("rejects duplicate keys", () => {
  assert.throws(() => parseYaml("a: 1\na: 2"), /duplicate key/);
});

test("rejects indented documents", () => {
  assert.throws(() => parseYaml("  a: 1"), /column 0/);
});

test("an empty document is an empty map", () => {
  assert.deepEqual(parseYaml("# only a comment\n"), {});
});

test("the real data file passes both gates", () => {
  const output = execFileSync(process.execPath, [join(ROOT, "scripts/build.mjs"), "--check"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.match(output, /all sourced/);
});
