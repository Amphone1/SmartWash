/* eslint-disable */
export default {
  displayName: 'gps',
  preset: '../../jest.preset.js',
  rootDir: '.',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  coverageDirectory: '../../coverage/services/gps',
};
