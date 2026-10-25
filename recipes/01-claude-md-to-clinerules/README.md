# CLAUDE.md to .clinerules

The project instructions file becomes one or more rule files.

## Run

```sh
mkdir -p .clinerules
cp before/CLAUDE.md .clinerules/01-project.md
```

## Then

- Delete the `@` import lines and fold the imported content into the file. Cline has no import directive.
- Move anything that only applies to some paths into its own file with `paths:` frontmatter. See `after/.clinerules/02-testing.md`.
- Number the files to set the order they are combined in.

## Watch out

Rule files are combined into one set. Keep one concern per file rather than
splitting a single rule across two files, because nothing merges them back
together.
