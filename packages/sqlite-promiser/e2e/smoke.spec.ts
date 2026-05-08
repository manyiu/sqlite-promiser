import { test, expect } from '@playwright/test';

test('create table, insert, select, close', async ({ page }, testInfo) => {
  await page.goto('/');

  const result = (await page.evaluate(async () => {
    const fn = (window as unknown as { __sqliteSmoke?: () => Promise<unknown> }).__sqliteSmoke;
    if (!fn) {
      throw new Error('window.__sqliteSmoke is not defined');
    }
    return fn() as Promise<{ row: { v?: string }; diag: { mode: string; persistent: boolean } }>;
  })) as { row: { v?: string }; diag: { mode: string; persistent: boolean } };

  expect(result.row?.v).toBe('hello');

  if (testInfo.project.name === 'opfs') {
    expect(result.diag.mode).toBe('opfs');
    expect(result.diag.persistent).toBe(true);
  } else {
    expect(result.diag.mode).toBe('memory');
    expect(result.diag.persistent).toBe(false);
  }
});
