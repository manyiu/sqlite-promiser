import { test, expect } from '@playwright/test';

// Next.js example sets COOP/COEP via next.config — OPFS is always the expected persistence mode.
test('nextjs demo opens database and inserts a row', async ({ page }) => {
  await page.goto('/');

  const status = page.locator('section').filter({ hasText: 'Status' });
  await expect(status).toContainText(/Ready \(opfs/i, { timeout: 15000 });

  await page.getByRole('button', { name: 'Insert row' }).click();
  await expect(status).toContainText(/Ready \(opfs/i, { timeout: 10000 });

  const rowsPre = page.locator('section').filter({ hasText: 'Rows (latest 20)' }).locator('pre');
  await expect(rowsPre).toContainText('row-', { timeout: 5000 });
});
