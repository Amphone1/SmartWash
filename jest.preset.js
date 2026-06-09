// Shared Jest preset for all projects (ts-jest, node env).
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['**/*.spec.ts'],
  // Workspace libs are consumed as source; map the path aliases for ts-jest.
  // Projects live at libs/* or services/* (depth 2), so ../../libs resolves.
  moduleNameMapper: {
    '^@smartwash/common$': '<rootDir>/../../libs/common/src/index.ts',
    '^@smartwash/nestkit$': '<rootDir>/../../libs/nestkit/src/index.ts',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: '<rootDir>/tsconfig.spec.json' },
    ],
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts'],
};
