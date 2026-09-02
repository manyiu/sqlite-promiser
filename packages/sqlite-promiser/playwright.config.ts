import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exampleDir = path.join(__dirname, '../../examples/example-vite');
const exampleNextDir = path.join(__dirname, '../../examples/example-nextjs');

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
      testMatch: 'smoke.spec.ts',
      use: { baseURL: 'http://localhost:5173' }
    },
    {
      name: 'opfs',
      testMatch: 'smoke.spec.ts',
      use: { baseURL: 'http://localhost:5174' }
    },
    {
      name: 'nextjs',
      testMatch: 'nextjs-smoke.spec.ts',
      use: { baseURL: 'http://localhost:3000' }
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
    },
    {
      command: 'pnpm build && pnpm exec next start --port 3000',
      cwd: exampleNextDir,
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000
    }
  ]
});
