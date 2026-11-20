// Unit and pipeline tests for the framework-free logic in src/app/lib (run with `npm run test:lib`).
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['src/app/test/**/*.test.ts'], environment: 'node' } });
