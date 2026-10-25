#!/bin/sh
# Fails on the vocabulary that marks generated filler.
#
# This is crude on purpose. It is not a style guide; it is a tripwire for the
# sentences nobody wants to argue about in review. Extend the list when a new
# pointless word shows up, not when it merely annoys you.
set -eu

PATTERN='seamless|effortless|powerful|cutting-edge|game-chang|in today|worth noting|simply put|dive into|delving|unlock|supercharge|revolution|empower|robust|best-in-class|comprehensive|at the end of the day|needless to say|world-class|leverage|take it to the next level'

status=0
for target in dist/index.html dist/gaps.html README.md recipes; do
  [ -e "$target" ] || continue
  if hits=$(grep -rniE "$PATTERN" "$target" 2>/dev/null); then
    printf 'lint-voice: banned phrase in %s\n' "$target" >&2
    printf '%s\n' "$hits" >&2
    status=1
  fi
done

if [ "$status" -eq 0 ]; then
  printf 'lint-voice: clean\n'
fi

exit "$status"
