# Hook to plugin

A `PreToolUse` command hook becomes a `beforeTool` handler on a plugin. This is the
recipe with the least certainty in it; read the last section before you copy anything.

## Run

```sh
cline plugin install ./after/plugin.ts
```

## Then

- Keep the shell script if you still want it. A `beforeTool` handler can shell out to it rather than reimplementing the pattern match.
- Delete the `hooks` block from the Claude Code settings file once Cline is enforcing the same rule, so the two do not drift.
- Confirm the hook is loaded: `cline config` shows installed plugins.

## Watch out

The public docs describe `beforeTool` as a place to audit tool calls and enforce policy
but do not publish the return shape that blocks one. `after/plugin.ts` observes and does
not block, with a `TODO` where the decision belongs. Read `AgentPlugin` in `@cline/sdk`
before you rely on this for anything that matters.
