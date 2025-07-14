import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['test/**/*.test.js', 'test/**/*.test.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
    setupFiles: ['./test/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'cobertura'],
      include: ['src/**/*.js', 'src/**/*.ts'],
      exclude: [
        'src/**/*.test.js',
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'node_modules/**',
        'test/**',
        '.next/**',
        'coverage/**'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    },
    reporters: ['default', 'junit'],
    outputFile: {
      junit: './test-results.xml'
    }
  }
})