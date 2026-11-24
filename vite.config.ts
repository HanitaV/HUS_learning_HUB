import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Relative output works at /, repository subpaths, and custom domains.
  base: './',
  plugins: [react(), tailwindcss()],
  server: { fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/docs/**', '**/.agents/**', '**/.claude/**'] } },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
});
