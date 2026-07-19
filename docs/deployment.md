# Deployment Directive

Status: active directive. This document defines the production promotion and
qualification path for Portfolio.

## Ownership and entry point

Production is the `.main/` worktree on branch `main`, served by
`portfolio-frontend.service`. Promotion is user-initiated from `dev/` through
the only supported entry point:

```sh
./scripts/deploy.sh
```

Do not fast-forward, install, build, or restart production manually in
`.main/`. The script owns sequencing and failure handling.

## Preconditions

The deployment requires:

- the command is running from the `dev/` worktree;
- the `.main/` worktree and systemd unit already exist;
- both worktrees have no tracked changes;
- `main` is an ancestor of `dev`, so promotion is fast-forward-only;
- `.main/.env.local` contains the protected production configuration.

Environment files, service configuration, and credentials remain untracked
operator state.

## Promotion sequence

The deployment script:

1. validates the worktrees, service, and fast-forward relationship;
2. fast-forwards `main` to `dev`;
3. installs `.main` dependencies from `bun.lock` with
   `bun install --frozen-lockfile`;
4. requires Agentime registry mode, rejecting machine-local package links;
5. builds the production Next.js bundle using `.main/.env.local`;
6. restarts `portfolio-frontend.service`;
7. waits for a successful loopback HTTP health response.

The Agentime protocol and client versions used by production are therefore
the exact registry artifacts committed in the consumer manifest and lockfile.

## Failure behavior

A failed precondition, install, dependency-mode check, or build stops before
the service restart. A restart or health failure is reported distinctly after
promotion. Inspect runtime failure with:

```sh
journalctl -u portfolio-frontend.service
```

Do not conceal a failed production phase by manually repeating later steps.
Correct the source or protected configuration and rerun the canonical
deployment.
