# AGENTS.md

Operating rules for AI agents working in this repository.

## Repository rules

- Make every tracked change in the `dev/` worktree on branch `dev`.
- Never edit tracked files, commit, or merge inside `.main/`. It is the
  production worktree for branch `main` and moves only through the canonical
  deployment workflow.
- Each worktree may have its own gitignored `.env.local`. Treat environment
  files, credentials, service state, and release state as external
  configuration; never commit them.
- Read the relevant directive before changing a governed domain. The `docs/`
  tree in `dev/` is authoritative; `.main/docs/` is only the last deployed
  snapshot.

The linked worktrees are:

```text
/root/Desktop/portfolio/
├── dev/      branch dev   — active development
└── .main/    branch main  — production, served by systemd
```

## Directive routing

[`docs/README.md`](docs/README.md) is the maintained documentation index.
Before working in a domain, read and follow its directive:

- [`docs/development.md`](docs/development.md) — workspace development,
  dependency modes, environment ownership, and Agentime client integration.
- [`docs/testing.md`](docs/testing.md) — test layers, placement, tooling, and
  canonical verification commands.
- [`docs/deployment.md`](docs/deployment.md) — production promotion,
  dependency installation, build, restart, and health qualification.

Multiple directives may apply to one change. Each directive owns its domain;
do not duplicate or redefine its contract in this file.

## Durable entry points

Use root `package.json` scripts and the directive documents as the authority
for current commands. Do not use bare `bun test`; it bypasses the maintained
Jest configuration. Production deployments are user-initiated and must use
the deployment entry point defined in `docs/deployment.md`.

## Maintaining this file

Keep this file limited to repository-wide operating rules and directive
routing. Workspace inventories, command catalogs, dependency procedures, and
deployment sequences belong to their owning source or directive.
