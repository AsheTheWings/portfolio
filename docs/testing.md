# Testing Directive

Status: active directive. This document defines the testing pattern for the
monorepo: what to test, where to put it, and how to run it. Read it before
adding tests or test infrastructure.

All four layers have working tooling and starter tests; see
[Current state](#current-state) for the concrete inventory. Extend each layer
in place as features are added.

## Principles

- **Test behavior, not implementation.** Assert what a user or caller
  observes, not private internals. Tests should survive a refactor that keeps
  behavior intact.
- **Follow the pyramid.** Many fast unit tests, fewer component/integration
  tests, a thin layer of browser smoke tests. Push logic down into pure
  functions so it can be tested at the cheapest layer.
- **Colocate tests with source.** A test lives next to the code it covers, so
  it moves, gets reviewed, and rots alongside it.
- **One assertion of intent per test.** Prefer several focused tests over one
  test with many unrelated expectations.
- **Deterministic and isolated.** No real network, no shared mutable state, no
  reliance on wall-clock time or test ordering. Reset stores and mocks between
  tests.
- **Trust boundaries get extra coverage.** Auth, route handlers, middleware,
  and anything parsing external input are high-value targets.

## The layers

### Layer 1 — Unit (the broad base)

Pure logic: `*/lib/*`, `*/utils/*`, zustand stores, reducers, `zod` schemas.

- Environment: `node` (fast, no DOM).
- Fully synchronous where possible; no network.
- This is where the majority of tests and coverage should live. Examples in
  this repo: chess engine (`packages/chess/src/lib/{board,notation,pgn}.ts`),
  parsers (`packages/ui/src/utils/libraryMentionParser.ts`,
  `packages/timeline/src/agent/utils/user-tags.ts`), eligibility/status helpers.

```ts
// packages/timeline/src/agent/utils/user-tags.test.ts
import { wrapClientUser, isAlreadyTagged } from './user-tags';

describe('wrapClientUser', () => {
  it('wraps and trims plain text', () => {
    expect(wrapClientUser('  hi  ')).toBe('<client_user>\nhi\n</client_user>');
  });

  it('passes through content that is already correctly tagged', () => {
    const input = '<client_user>hi</client_user>';
    expect(wrapClientUser(input)).toBe(input);
  });
});
```

### Layer 2 — Component & hook (the middle)

React components and hooks via **React Testing Library** + `jsdom`.

- Environment: `jsdom`.
- Query by role/label/text; drive interactions with `@testing-library/user-event`.
- Render through the real providers (Theme, a **fresh** React Query
  `QueryClient` per test, store reset) using a shared `renderWithProviders`
  helper — do not reach into component internals.
- Test files are named `*.test.tsx`.

```tsx
// example shape
import { renderWithProviders, screen } from '@/test/render';
import userEvent from '@testing-library/user-event';
import { MessageInput } from './MessageInput';

it('disables Insert until there is text content', async () => {
  const onInsert = jest.fn();
  renderWithProviders(<MessageInput userMode="developer" onInsert={onInsert} onSend={jest.fn()} />);

  const insert = screen.getByRole('button', { name: /insert/i });
  expect(insert).toBeDisabled();

  await userEvent.type(screen.getByRole('textbox'), 'hello');
  expect(insert).toBeEnabled();
});
```

### Layer 3 — API / integration

Next.js route handlers (`app/api/**/route.ts`) and `middleware.ts`.

- Invoke the handler directly with a constructed `NextRequest`.
- Mock the upstream backend with **MSW** (Mock Service Worker) — never hit a
  real backend.
- Assert status codes, error mapping, and security behavior (e.g. the JWT is
  set as an **HTTP-only** cookie and never returned in the body).

```ts
// example shape
import { POST } from './route';
import { NextRequest } from 'next/server';

it('sets an http-only cookie and returns only the user on success', async () => {
  // MSW handler stubs BACKEND_URL/auth/login → { token, user }
  const res = await POST(new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'a@b.co', password: 'x' }),
  }));

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ user: expect.any(Object) });
  expect(res.headers.get('set-cookie')).toMatch(/HttpOnly/i);
});
```

### Layer 4 — Browser smoke (the thin top)

A small set of **Playwright** smoke flows driven through a real browser against
a production build (`next start`): login → land on an app, send a chat message,
navigate the timeline. Keep this layer minimal — it is the slowest and most
brittle. Do not duplicate logic already covered by lower layers.

## Conventions

- **Placement**: colocate. `foo.ts` → `foo.test.ts`; `Foo.tsx` → `Foo.test.tsx`.
  Cross-cutting suites may live in a `__tests__/` directory.
- **Naming**: `*.test.ts` for `node` logic, `*.test.tsx` for DOM/component
  tests. The Jest environment is selected from this distinction (see config).
- **Shared test code**: a top-level `test/` holds reusable helpers —
  `renderWithProviders`, MSW server + handlers, `next/navigation` mocks, and
  store-reset utilities.
- **Test data**: build with small factory helpers (e.g. `makeSession({...})`)
  rather than copy-pasted literals, so a schema change touches one place.
- **Mock at boundaries only**: mock the network (MSW) and framework seams
  (`next/navigation`, `next/server`), not the unit under test.

## Tooling

Selected to match the existing stack (Jest is already present):

- **Runner**: Jest 30, configured with **`projects`** so `node` (logic) and
  `jsdom` (components) run in a single pass.
- **Transform**: `ts-jest` today; `@swc/jest` is an acceptable speed upgrade
  since `tsc --noEmit` already provides the type gate.
- **DOM**: `jest-environment-jsdom`, `@testing-library/react`,
  `@testing-library/jest-dom`, `@testing-library/user-event`.
- **Network**: `msw` for both route-handler tests and client data-fetching
  (SWR / React Query) tests.
- **Browser smoke**: `@playwright/test`.

### Jest `projects` sketch

```js
// jest.config.js
module.exports = {
  projects: [
    {
      displayName: 'node',
      testEnvironment: 'node',
      testMatch: ['**/*.test.ts'],
    },
    {
      displayName: 'dom',
      testEnvironment: 'jsdom',
      testMatch: ['**/*.test.tsx'],
      setupFilesAfterEnv: ['<rootDir>/test/setup.dom.ts'], // imports @testing-library/jest-dom
    },
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@portfolio/(.*?)$': '<rootDir>/../../packages/$1/src/index.ts',
    '^@portfolio/(.*?)/(.*)$': '<rootDir>/../../packages/$1/src/$2',
  },
};
```

> The config must scan **all workspaces**, not just `apps/portfolio`. Use a
> root-level config (or per-package configs aggregated via
> `bun --filter '*' test`) so a test in `packages/**` is actually discovered.

## Running tests

From `dev/`:

```sh
bun run test                # full suite (node + jsdom projects)
bun run test -- user-tags   # filter by name/path
bun run test:watch          # watch mode
bun run test:coverage       # with coverage report + threshold check
bun run test:browser        # Playwright browser smoke (after: bunx playwright install)

# narrower runs (from apps/portfolio/)
npx jest --selectProjects node   # logic + route handlers only
npx jest --selectProjects dom    # components + hooks only
```

> Use `bun run test`, not `bun test`. `bun test` invokes Bun's built-in test
> runner, which bypasses the Jest config (projects, jsdom, transforms) and will
> mis-run these suites. The Jest runner is always reached via `bun run`.

See the root `package.json` `scripts` for the authoritative list.

## Coverage & CI

- `coverageThreshold` is enforced under `--coverage`. The current global floor
  is low (`statements/lines 10, branches 10, functions 6`) because the suite is
  young — **ratchet it up** as coverage grows toward ~50–60% global, 80%+ for
  `lib`/`utils` and all auth code.
- CI (`.github/workflows/ci.yml`) runs, on every PR into `dev`/`main` and push
  to `dev`, the same gate `AGENTS.md` prescribes:

  ```sh
  bun run typecheck && bun run lint && bun run test && bun run build
  ```

  Keep these green before merging. `main` only advances by fast-forward from
  `dev`, so the gate on `dev` is the release gate.

## What to test first

Highest value per unit of effort, in order:

1. Pure logic — `packages/chess/src/lib/{board,notation,pgn}.ts`,
   `packages/ui/src/utils/libraryMentionParser.ts`,
   `packages/timeline/src/agent/utils/{workflow-eligibility,status,models}.ts`.
2. Security-critical Layer 3 — the four `app/api/auth/*` route handlers and
   `middleware.ts`, with MSW stubbing the backend.
3. Then component/hook coverage for the most-used UI, and a couple of
   Playwright smoke flows.

## Current state

The four layers and their canonical commands are implemented. Keep the
inventory below aligned with executable suite ownership without recording
volatile test counts.

- **Runner**: Jest 30 with two `projects` (`node` + `jsdom`) in
  `apps/portfolio/jest.config.js`, discovering tests across `apps/portfolio/src`
  and every `packages/*/src`.
- **Aliases**: `@/*`, `@portfolio/*`, and `@test/*` resolve in both Jest and
  `tsconfig`.
- **Shared helpers** (`apps/portfolio/test/`): `render.tsx`
  (`renderWithProviders` + re-exported RTL/`userEvent`), `msw/{server,handlers}.ts`,
  `setup.msw.ts` (node), `setup.dom.ts` (jest-dom + cleanup + `matchMedia`
  polyfill).
- **Starter tests**:
  - Layer 1 — `libraryMentionParser`, chess `board`/`notation`/`pgn`,
    `workflow-eligibility`, `user-tags`.
  - Layer 2 — `useMessageComposer` hook, `ThemeSwitcher` component.
  - Layer 3 — `auth/login` route (MSW), `cookies` helpers, `middleware`.
  - Layer 4 — Playwright config + `browser/smoke.spec.ts` (scaffold; run locally
    after `bunx playwright install`).
- **Coverage**: global floor enforced under `--coverage`
  (`statements/lines 10, branches 10, functions 6`); ratchet up over time.
- **CI**: `.github/workflows/ci.yml` runs typecheck → lint → test → build on
  PRs into `dev`/`main` and pushes to `dev`.

### MSW + Jest note

MSW v2 and `jose` ship ESM-only code with ESM-only transitive deps. The `node`
project transforms them with `babel-jest` and allowlists them via
`transformIgnorePatterns` (the `ESM_DEPS` array in `jest.config.js`). If a
dependency upgrade introduces another ESM-only package and you see
"Cannot use import statement outside a module", add its name to `ESM_DEPS`.
