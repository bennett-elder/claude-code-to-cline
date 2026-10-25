# Project

## Stack

Node 22, Fastify, Postgres through Drizzle. Tests use `node:test`.

## Rules

- Never hand-edit anything under `db/migrations/`. Generate it.
- One handler per resource, all of them in `src/routes/`.
- Run `npm test` before claiming a task is done.

## Architecture

See `docs/architecture.md`. The error taxonomy lives in `docs/error-taxonomy.md`;
read it before adding a new error class.
