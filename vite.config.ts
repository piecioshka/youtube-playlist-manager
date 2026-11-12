import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { contentSecurityPolicy } from './vite-plugin-csp.ts';
import { themeBoot } from './vite-plugin-theme-boot.ts';

export default defineConfig({
  // GitHub Pages serves the app from a subdirectory, locally it is the root
  base: process.env.BASE_PATH || '/',
  plugins: [react(), themeBoot(), contentSecurityPolicy()],
  build: {
    rolldownOptions: {
      input: {
        main: 'index.html',
        // The privacy policy Google links on the OAuth consent screen
        privacy: 'privacy.html',
      },
    },
  },
});
