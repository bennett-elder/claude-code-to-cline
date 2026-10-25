# Acme API

## Stack

Node 22, Fastify, Postgres through Drizzle. Tests use `node:test`.

## Rules

- Never hand-edit anything under `db/migrations/`. Generate it.
- One handler per resource, all of them in `src/routes/`.
- Run `npm test` before claiming a task is done.

## Testing

Integration tests hit a real Postgres in Docker. Unit tests never touch the network.

@docs/architecture.md
@docs/error-taxonomy.md
