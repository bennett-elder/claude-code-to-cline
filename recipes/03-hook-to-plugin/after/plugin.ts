import type { AgentPlugin } from "@cline/sdk";

// The same guard as guard-bash.sh, moved into Cline's hook surface.
//
// Cline has no config-file hook. beforeTool is the only event that stands in
// for PreToolUse, and it belongs to a plugin.

const BLOCKED = [/push\s+--force/, /push\s+-f\b/, /rm\s+-rf\s+\//];

const guard: AgentPlugin = {
  name: "no-destructive-git",
  manifest: { capabilities: ["hooks"] },
  hooks: {
    beforeTool(context) {
      // The tool call arrives on `context`. Read the command off it.
      const call = context as { input?: { command?: string } };
      const command = call.input?.command ?? "";

      if (BLOCKED.some((pattern) => pattern.test(command))) {
        // TODO: return the decision that blocks the call.
        //
        // The public docs describe beforeTool as a place to audit tool calls
        // and to enforce policy, but do not publish the return shape that
        // stops one. Read AgentPlugin in @cline/sdk and fill this in. Until
        // then this hook observes and does not block.
        return undefined;
      }

      return undefined;
    },
  },
};

export default guard;
