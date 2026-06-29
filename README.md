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
bun install      # install workspace dependencies
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

- [`docs/testing.md`](./docs/testing.md) — testing pattern: the layers
  (unit → component → API/integration → browser smoke), conventions, tooling, and what
  to test first. Read this before adding tests.

Operating rules for AI agents (worktree layout, the `dev/` vs `.main/`
distinction, and the pre-merge checklist) are in [`AGENTS.md`](./AGENTS.md).

## Repository layout

```
portfolio/
├── dev/      branch `dev`   → active development (this worktree)
└── .main/    branch `main`  → stable / release branch
```

All work happens in `dev/`. `main` advances only by fast-forward from `dev`.
See [`AGENTS.md`](./AGENTS.md) for the full worktree rules.
