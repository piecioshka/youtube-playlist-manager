import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { contentSecurityPolicy } from './vite-plugin-csp.ts';

export default defineConfig({
  // GitHub Pages serwuje aplikację z podkatalogu, lokalnie z roota
  base: process.env.BASE_PATH || '/',
  plugins: [react(), contentSecurityPolicy()],
});
