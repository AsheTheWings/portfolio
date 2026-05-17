/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
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
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.tsx',
    '!src/**/*.test.ts',
    '!src/**/*.test.tsx',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
};

module.exports = config;
