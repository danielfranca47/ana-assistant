/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'CommonJS',
        },
      },
    ],
  },
  clearMocks: true,
  passWithNoTests: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/types/**',
    '!src/server.ts',
  ],
}

module.exports = config
