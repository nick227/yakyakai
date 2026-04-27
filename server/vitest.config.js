import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/tests/setup.js'],
    include: ['src/tests/api/**/*.test.js'],
    exclude: ['node_modules', 'dist', '.git', 'src/tests/*.test.js'],
    env: {
      NODE_ENV: 'test',
    },
  },
})
