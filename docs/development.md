# Development Directive

Status: active directive. This document defines Portfolio workspace
development, dependency modes, and local environment ownership.

## Workspace contract

Portfolio is a Bun workspace containing the Next.js application under `apps/`
and shared frontend packages under `packages/`. The root `package.json`
workspace globs and scripts are the current authority; documentation does not
maintain a second package inventory.

Install and run from the `dev/` worktree:

```sh
bun install --frozen-lockfile
bun run dev
```

Environment values belong in the gitignored `.env.local` for the active
worktree. Browser-exposed values must use the explicit Next.js public
environment convention. Credentials and server-only values must never enter
browser bundles or tracked source.

## Agentime client dependency modes

Portfolio consumes only `@agentime/protocol` and `@agentime/client`. Their
committed declarations are exact public-registry versions, and `bun.lock`
remains the reproducible installation authority. Portfolio does not depend on
or import a server package.

There are exactly two local dependency modes.

**Registry mode** installs the committed versions from the frozen lockfile. It
is required for CI, production builds, deployment, and verification of a
published package release:

```sh
bun run agentime:registry
bun run agentime:status --require registry
```

**Linked mode** is the cross-repository inner loop while protocol or client
source is changing. First register the built protocol and client packages from
their Agentime source workspace. Keep that workspace's package watcher
running, then activate both links together:

```sh
# Agentime source workspace
bun run agentime:links:register
bun run dev

# Portfolio dev worktree
bun run agentime:link
bun run agentime:status --require linked
bun run dev
```

Linked packages still execute their declared `dist/` exports. Source changes
become visible only after the producer build or watcher updates those outputs.
Protocol and client must resolve from one coordinated source workspace; a
mixed linked/registry state fails closed.

Do not run ad hoc `bun link` commands in this repository. Bun saves link
specifiers by default. The maintained command uses `--no-save`, replaces only
the consumer workspace's installed links, verifies built package identity, and
proves that the root manifest, consumer manifest, and lockfile remain
byte-for-byte unchanged. Bun rejects a temporary link graph under
`--frozen-lockfile`; frozen resolution instead belongs to registry
restoration. If linking fails partway, the command force-restores the frozen
registry graph.

Before switching branches, qualifying registry packages, or handing the
worktree to deployment, restore registry mode. Machine-local link registration
is developer state and is never a repository dependency.

## Agentime frontend boundary

The `@portfolio/timeline` package owns React components, hooks, Zustand
projections, browser authentication acquisition, and the optional localhost
MCP adapter. It consumes Agentime transport, protocol, and delegated-tool
contracts through declared public exports. It does not recreate wire DTOs,
reach into package source directories, or import backend implementation.

Client-provided tools extend an active Agentime connection through the client
tool-provider contract. Portfolio does not splice their descriptors into a
server registry.
