/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\.spec\.ts$',
  transform: { '^.+\.ts$': 'ts-jest' },
  collectCoverageFrom: ['**/*.ts', '!**/*.module.ts', '!main.ts', '!**/__tests__/**', '!**/dto/**', '!**/schemas/**'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
