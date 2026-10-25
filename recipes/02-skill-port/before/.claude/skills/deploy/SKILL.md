---
name: deploy
description: Deploy the API to staging or production. Use when asked to deploy, roll out, ship, or promote a build.
allowed-tools: Bash(git push:*), Bash(kubectl:*), Read
model: sonnet
context: fork
disable-model-invocation: false
---

# Deploy

## Steps

1. Confirm the target environment with the user before anything else. Staging and production are different procedures.
2. Run `npm test` and stop if it fails.
3. Build and push the image, then apply the manifests under `k8s/`.
4. Watch rollout status and report the pod names.

## Boundaries

Only `git` and `kubectl` commands are in scope. Do not modify manifests as part
of a deploy; that is a separate change.
