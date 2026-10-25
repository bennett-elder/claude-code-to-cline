#!/bin/sh
# Blocks force-push and destructive rm under the project root.
#
# Exit 2 blocks the tool call and sends stderr back to the model, which is the
# documented way for a command hook to refuse an action.
input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // ""')

case "$command" in
  *"push --force"*|*"push -f"*|*"rm -rf /"*)
    echo "blocked: force-push and destructive rm are not allowed in this repo" >&2
    exit 2
    ;;
esac

exit 0
