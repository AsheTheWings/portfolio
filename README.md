# Portfolio

A Bun-workspaces monorepo built on Next.js (App Router), React, and
TypeScript. `apps/` holds the Next.js application; `packages/` holds the shared
workspace libraries it consumes.

Explore the tree directly for the current set of workspaces — see the root
[`package.json`](./package.json) `workspaces` and `scripts` for the
authoritative list.

## Getting started

Prerequisites: [Bun](https://bun.sh) (see `packageManager` in
[`package.json`](./package.json) for the pinned version).

```sh
bun install --frozen-lockfile
bun run dev      # start the Next.js app in development
```

## Common commands

Run from this directory (`dev/`):

```sh
bun run dev         # develop
bun run build       # production build (strongest pre-merge check)
bun run start       # serve a production build
bun run typecheck   # tsc --noEmit
bun run lint        # next lint
bun run test        # test suite (Jest — use `bun run test`, not `bun test`)
```

Keep `typecheck`, `lint`, `test`, and `build` green before committing.

## Documentation

Project documentation lives in [`docs/`](./docs/):

- [`docs/README.md`](./docs/README.md) — authoritative directive index.
- [`docs/development.md`](./docs/development.md) — workspace and dependency
  development, including local Agentime client links.
- [`docs/testing.md`](./docs/testing.md) — test layers, conventions, and
  tooling.
- [`docs/deployment.md`](./docs/deployment.md) — production promotion and
  qualification.

Repository-wide worktree rules and directive routing are in
[`AGENTS.md`](./AGENTS.md).

## Repository layout

```
portfolio/
├── dev/      branch `dev`   → active development (this worktree)
└── .main/    branch `main`  → stable / release branch
```

All work happens in `dev/`. `main` advances only through the deployment
workflow defined in [`docs/deployment.md`](./docs/deployment.md).
