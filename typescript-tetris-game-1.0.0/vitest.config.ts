import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Console output plus a JUnit XML file that the CI uploads as test results.
    reporters: ['default', 'junit'],
    outputFile: { junit: 'test-results/junit.xml' },
    coverage: {
      provider: 'v8',
      // main.ts only wires the game to the DOM/canvas; the testable logic lives in game.ts.
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/main.ts'],
      reporter: ['text', 'html', 'lcov', 'json-summary', 'json'],
      reportsDirectory: 'coverage',
      reportOnFailure: true,
    },
  },
});
