import { test, expect } from '@playwright/test';

test('nextjs demo opens database and inserts a row', async ({ page }) => {
  await page.goto('http://localhost:3000/');

  await expect(page.getByRole('strong')).toContainText(/Ready \(opfs/i, { timeout: 15000 });

  await page.getByRole('button', { name: 'Insert row' }).click();
  await expect(page.getByRole('strong')).toContainText(/Ready \(opfs/i, { timeout: 10000 });

  const rowsPre = page.locator('section').filter({ hasText: 'Rows (latest 20)' }).locator('pre');
  await expect(rowsPre).toContainText('row-', { timeout: 5000 });
});
