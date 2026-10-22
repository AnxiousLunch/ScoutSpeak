import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      voicesession: path.resolve(__dirname, 'packages/voicesession/src/index.ts'),
      prospectkit: path.resolve(__dirname, 'packages/prospectkit/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    env: { AI_BASE_URL: 'http://localhost:0', AI_API_KEY: 'test', AI_MODEL: 'test' },
  },
})