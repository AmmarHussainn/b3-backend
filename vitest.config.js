import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { setupFiles: ['tests/setup.js'], testTimeout: 60000, hookTimeout: 180000, fileParallelism: false, include: ['tests/**/*.test.js'] } });
