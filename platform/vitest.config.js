import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/**/*.test.js', 'test/**/*.test.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
    setupFiles: ['./test/setup.js']
  }
})