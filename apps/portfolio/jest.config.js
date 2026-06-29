/**
 * Jest configuration — see ../../docs/testing.md
 *
 * Two projects run in a single pass:
 *   - "node": pure logic / route handlers (`*.test.ts`), Node environment.
 *   - "dom" : components & hooks (`*.test.tsx`, `*.dom.test.ts`), jsdom.
 *
 * Discovery spans the app and every workspace package, so a test colocated
 * anywhere under `apps/portfolio/src` or `packages/<pkg>/src` is picked up.
 */

/** Resolve `@/*` and `@portfolio/*` the same way tsconfig paths do. */
const moduleNameMapper = {
  '^@/(.*)$': '<rootDir>/src/$1',
  '^@test/(.*)$': '<rootDir>/test/$1',
  '^@portfolio/api-client$': '<rootDir>/../../packages/api-client/src/index.ts',
  '^@portfolio/api-client/(.*)$': '<rootDir>/../../packages/api-client/src/$1',
  '^@portfolio/auth$': '<rootDir>/../../packages/auth/src/index.ts',
  '^@portfolio/auth/(.*)$': '<rootDir>/../../packages/auth/src/$1',
  '^@portfolio/chess$': '<rootDir>/../../packages/chess/src/index.ts',
  '^@portfolio/chess/(.*)$': '<rootDir>/../../packages/chess/src/$1',
  '^@portfolio/timeline$': '<rootDir>/../../packages/timeline/src/index.ts',
  '^@portfolio/timeline/(.*)$': '<rootDir>/../../packages/timeline/src/$1',
  '^@portfolio/ui$': '<rootDir>/../../packages/ui/src/index.ts',
  '^@portfolio/ui/(.*)$': '<rootDir>/../../packages/ui/src/$1',
};

const transform = {
  '^.+\\.tsx?$': ['ts-jest', {
    tsconfig: {
      jsx: 'react-jsx',
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
    },
  }],
};

// MSW v2 and jose ship ESM-only code (and pull in ESM-only transitive deps:
// rettime, until-async, etc.) that Jest can't parse as-is. The node project
// transforms them via babel-jest and allowlists them out of the default
// node_modules ignore. If a future dep upgrade adds another ESM-only package,
// add it here.
const ESM_DEPS = [
  'msw', '@mswjs', '@bundled-es-modules', 'rettime', 'until-async',
  'headers-polyfill', '@open-draft', 'tough-cookie', 'strict-event-emitter',
  'outvariant', 'is-node-process', 'jose',
];

const nodeTransform = {
  ...transform,
  '^.+\\.(js|mjs|cjs)$': ['babel-jest', {
    presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
  }],
};

const nodeTransformIgnorePatterns = [
  `/node_modules/(?!(${ESM_DEPS.join('|')})/)`,
  '/\\.next/',
];

const roots = ['<rootDir>/src', '<rootDir>/../../packages'];

// Never treat build output, deps, or browser (Playwright) specs as Jest tests.
const sharedIgnore = ['/node_modules/', '/\\.next/', '/browser/'];

/** @type {import('jest').Config} */
const config = {
  projects: [
    {
      displayName: 'node',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots,
      moduleNameMapper,
      transform: nodeTransform,
      transformIgnorePatterns: nodeTransformIgnorePatterns,
      testMatch: ['**/*.test.ts'],
      testPathIgnorePatterns: [...sharedIgnore, '\\.dom\\.test\\.ts$'],
      setupFilesAfterEnv: ['<rootDir>/test/setup.msw.ts'],
    },
    {
      displayName: 'dom',
      preset: 'ts-jest',
      testEnvironment: 'jsdom',
      roots,
      moduleNameMapper,
      transform,
      testMatch: ['**/*.test.tsx', '**/*.dom.test.ts'],
      testPathIgnorePatterns: sharedIgnore,
      setupFilesAfterEnv: ['<rootDir>/test/setup.dom.ts'],
    },
  ],

  // Coverage (collected only with --coverage). The global threshold is an
  // intentionally low floor for a young suite — RATCHET IT UP as coverage
  // grows (see docs/testing.md). Per-file thresholds are deliberately avoided
  // here: with Jest `projects` spanning multiple workspace packages, path-key
  // matching is brittle. Prefer raising the global floor over time.
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '../../packages/*/src/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/*.stories.tsx',
    '!**/*.test.{ts,tsx}',
    '!**/index.ts',
    '!**/types/**',
    '!**/test/**',
    '!**/browser/**',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: { statements: 10, branches: 10, functions: 6, lines: 10 },
  },
  verbose: true,
};

module.exports = config;
