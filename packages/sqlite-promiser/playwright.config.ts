import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exampleDir = path.join(__dirname, '../../examples/example-vite');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
    ...devices['Desktop Chrome']
  },
  projects: [
    {
      name: 'memory',
      use: { baseURL: 'http://localhost:5173' }
    },
    {
      name: 'opfs',
      use: { baseURL: 'http://localhost:5174' }
    }
  ],
  webServer: [
    {
      command: 'pnpm exec vite --port 5173 --strictPort',
      cwd: exampleDir,
      env: {
        ...process.env,
        VITE_COOP: '0',
        PORT: '5173'
      },
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI
    },
    {
      command: 'pnpm exec vite --port 5174 --strictPort',
      cwd: exampleDir,
      env: {
        ...process.env,
        VITE_COOP: '1',
        PORT: '5174'
      },
      url: 'http://localhost:5174',
      reuseExistingServer: !process.env.CI
    }
  ]
});
