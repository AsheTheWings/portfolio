# AGENTS.md

Operating rules for AI agents working in this repository. Read this before
making changes.

## TL;DR

- Do **all** work in the **`dev/`** worktree (branch `dev`).
- **Never edit tracked files in the `.main/` worktree.** It is the deploy target
  for branch `main` and is updated only by `scripts/deploy.sh`.
- `dev/` is the source of truth; `.main/` is only a snapshot of `main`.

## Repository layout

This project is a single git repo checked out as **two linked worktrees** under
/root/Desktop/portfolio/:

```
portfolio/
├── dev/      branch `dev`   → active development (this worktree)
└── .main/    branch `main`  → production; served by systemd
```

- The directory `.main` (leading dot) holds the **`main`** branch. "The `.main`
  worktree" and "the `main` branch" refer to the same line of history.
- Production runs from `.main` via the systemd unit **`portfolio-frontend.service`**
  (`WorkingDirectory=.../.main`, `bun run start`).

## Worktree rules

1. All code changes, commits, and tests happen in **`dev/`**.
2. **Do not edit, commit, or `git merge` inside `.main/`.** It only ever moves
   forward by fast-forward from `dev` during a deploy.
3. Exception — **local config is per-worktree**: each worktree has its own
   gitignored env files (`.env.local`). Adjusting them is configuration, not a
   code change, and is allowed. Never move secrets into tracked files.

## Project structure

Bun-workspaces monorepo (Next.js). `apps/` holds the Next.js application and
`packages/` holds shared workspace libraries it consumes. Explore the tree
directly — this file intentionally does not enumerate workspaces so it won't
drift as they change.

## Deploying (main ← dev)

Deploys are **user-initiated only**. From the `dev` worktree:

```sh
./scripts/deploy.sh
```

It fast-forwards `main` to `dev` (refuses a non-fast-forward), installs deps,
builds production Next.js bundles, restarts `portfolio-frontend.service`, and
health-checks it. Requirements:

- The systemd unit must already exist — `deploy.sh` does **not** provision it.
- `sudo systemctl` access for the restart.

Do not perform these steps by hand in `.main`; use the script so the safety
checks (clean tree, fast-forward-only, build-before-restart) always run.

## Verifying changes (in `dev/`)

To run the development server:

```sh
bun run next dev -p 3010
```

Other verification checks:

```sh
bun run typecheck   # tsc --noEmit
bun run lint        # next lint
bun run test        # test suite (Jest; `bun test` runs Bun's own runner)
bun run build       # production build — the strongest pre-merge check
```

Keep these green before committing.

## Maintaining this file

Keep AGENTS.md **durable**. State rules and orientation that rarely change; do
not couple it to volatile detail — workspace-by-workspace structure, file
names, or exhaustive command lists. Point to the living source instead (the
tree itself, the root `package.json` workspaces and scripts). If a line here
would need editing every time a package or route is added, it belongs in that
source, not in this file.

## Testing Credentials (dev db)

You can use the following credentials for local testing in the dev database:
- **Username**: `Ashe`
- **Password**: `dsT$C4KDuLA_4H`
