import { defineConfig, devices } from '@playwright/test';
import detect from 'detect-port';

/*
 * Port wybierany raz na proces i przekazywany przez env: worker, który
 * wybrałby port ponownie, trafiłby w inny niż ten, na którym słucha serwer.
 */
const port = Number(process.env.E2E_PORT ?? (await detect(4173)));
process.env.E2E_PORT = String(port);

// `vite preview` na `localhost` binduje na macOS tylko ::1, dlatego jawne 127.0.0.1
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Zawsze świeży build: ponowne użycie serwera testowałoby stary dist/
    command: `npm run build && npm run preview -- --port ${port} --strictPort --host 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_GOOGLE_CLIENT_ID: 'e2e-client-id',
      BASE_PATH: '/',
    },
  },
});
