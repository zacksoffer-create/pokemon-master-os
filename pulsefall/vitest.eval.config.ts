import { defineConfig } from 'vitest/config';

// Evaluation on real recordings in .eval/ (not committed; see tests/eval/README.md).
export default defineConfig({
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  test: { include: ['tests/eval/**/*.eval.ts'], environment: 'node', testTimeout: 600000 },
});
