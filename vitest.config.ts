import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    // Stała strefa czasowa, żeby testy dat nie zależały od maszyny
    env: { TZ: 'Europe/Warsaw' },
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.spec.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
    },
  },
});
