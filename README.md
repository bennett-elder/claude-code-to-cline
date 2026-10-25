# Claude Code → Cline

A construct-by-construct map of the agent harness: what a `CLAUDE.md` becomes, what
`.claude/skills` becomes, what happens to a `PreToolUse` hook, and which constructs have
no Cline equivalent at all.

**The page is generated. `comparison.yaml` is the artifact.**

## Why it is built this way

A comparison written as prose drifts into claims nobody can check. So the data file is
the source of truth and two gates refuse to build a page that breaks the rules:

1. **Source gate** — every construct must cite a source URL for *both* products. Every
   gap must cite at least one. A row with no citation fails the build.
2. **Staleness gate** — every row carries a `verified` date. Rows older than
   `meta.stale_after_days` render with a `stale` badge rather than quietly ageing.

There are two softer gates, both about presentation rather than truth.
`scripts/lint-voice.sh` fails on the vocabulary that marks generated filler; it is
crude on purpose, and it catches the sentences you would otherwise have to argue
about in review. `scripts/lint-prose.mjs` fails when markdown syntax reached the page
unrendered, because a literal bold marker in a paragraph is a defect the build would
otherwise ship in silence.

## Layout

```
comparison.yaml          source of truth — constructs, gaps, limitations
scripts/build.mjs        validates, then renders dist/ ; writes nothing in --check
scripts/lib/yaml.mjs     minimal YAML subset parser, fails loudly on unsupported syntax
scripts/lib/markdown.mjs recipe README renderer: paragraphs and inline code
scripts/lib/prose.mjs    finds markdown syntax that reached the page unrendered
scripts/lint-voice.sh    banned-phrase check over generated output
scripts/lint-prose.mjs   CLI around scripts/lib/prose.mjs
test/                    parser, renderer, and gate tests, no network
recipes/                 migration recipes: real before/ after/ trees plus README
assets/style.css         one stylesheet, no framework
dist/                    build output, gitignored, published as an artifact
```

## Adding or fixing a row

Edit `comparison.yaml`. Then:

```sh
npm run verify
```

`verify` runs the source gate, the tests, the build, and the voice lint. If you changed
the data but forgot to rebuild, CI catches it: the workflow rebuilds and fails on a dirty
`index.html`.

### Schema

```yaml
constructs:
  - id: "instructions"          # unique, used as the HTML anchor
    name: "Always-on instructions"
    equivalence: "exact"        # exact | partial | none
    claude_code:
      where: "..."              # where it lives
      mechanism: "..."          # how it actually works
    cline:
      where: "..."
      mechanism: "..."
    note: "..."                 # optional, the interesting part
    surfaces:                   # optional, only if the docs state a restriction
      vscode: "no"              # yes | no | unknown
      desktop: "unknown"
    source:
      claude_code: "https://..."
      cline: "https://..."
    verified: "2026-10-24"
```

`equivalence` is a verdict, not a hedge. `none` is a legitimate and useful value — the
rows marked `none` are the reason this page exists.

### The YAML subset

`scripts/lib/yaml.mjs` is not a YAML implementation. It supports nested maps, block
lists, quoted strings, integers, booleans, and `null`. It **throws** on tabs, block
scalars (`|`, `>`), anchors, and any line it cannot parse. Quote any value containing
`: ` or a leading special character.

That is deliberate: an unsupported construct becomes a build error naming the line,
never a silently wrong page.

## Staleness

Both products ship weekly and Cline's own docs currently disagree with themselves —
`/features/skills` and `/customization/skills` both resolve, and `/customization/hooks`
is a stub that redirects to the SDK plugin docs. So `verified` records the date of the
*claim*, not the date of the page. Re-verify before you trust a row; the badge tells you
which ones to check first.

## Publishing

Pages is built by Actions and served as an artifact, so nothing generated is committed.
`.github/workflows/pages.yml` runs the gates, builds `dist/`, and deploys it:

Enable Pages once, before the first push. It has to be done with a user token, because
the workflow's `GITHUB_TOKEN` is not permitted to create a Pages site:

```sh
gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow
```

That is the same as Settings → Pages → Source: *GitHub Actions*. After that, every push
to `main` deploys. `dist/` is gitignored, and there is no `.nojekyll`, because an
artifact never goes through Jekyll.

To preview locally without publishing:

```sh
npm run build
python3 -m http.server -d dist 8000
```

`npm run verify` is the same sequence the workflow runs: source gate, tests, build,
both linters. It needs no install, because there are no dependencies.

## Rows still to add

Only verified claims are published, so these are deliberately absent rather than guessed:

- Claude Code scheduled runs (`Run prompts on a schedule`) — Cline has `cline schedule`
- Checkpoint/rewind semantics on both sides
- Output styles and `outputStyle`
- Subagent memory directories
- `.clineignore` removal vs Claude's deny rules
