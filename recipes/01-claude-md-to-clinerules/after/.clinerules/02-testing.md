---
paths:
  - "src/**"
  - "test/**"
---

# Testing

Integration tests hit a real Postgres in Docker. Unit tests never touch the network.

Any new route needs three tests before it is done: a happy path, a validation
failure, and an auth failure.
