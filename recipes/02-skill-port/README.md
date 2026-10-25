# Skill port

The file format is the same on both sides, so the move is a directory rename plus a
frontmatter trim.

## Run

```sh
mkdir -p .cline/skills
cp -R before/.claude/skills/deploy .cline/skills/deploy
```

## Then

- Delete the keys Cline does not document: `allowed-tools`, `model`, `context: fork`, `disable-model-invocation`.
- Keep `name` matching the directory name exactly. Both are required.
- Move whatever the dropped keys were enforcing into the body. The boundaries paragraph in `after/` is the `allowed-tools` list written as a sentence.

## Watch out

A skill that relied on `context: fork` to keep its work out of your main context now
runs inline. That is the one change in this recipe that costs you context rather than
just precision.
