import type { Page } from '@playwright/test';

import { expect, field, test } from './fixtures';

const SECRET = 'correct horse battery staple ✨\nsecond line\t tabbed';

async function split(
  page: Page,
  secret: string,
  shares: string,
  threshold: string,
): Promise<string[]> {
  await page.getByLabel(field.secret, { exact: true }).fill(secret);
  await page.getByLabel(field.shareCount, { exact: true }).fill(shares);
  await page.getByLabel(field.threshold, { exact: true }).fill(threshold);
  await page.getByRole('button', { name: 'Split secret', exact: true }).click();

  const collected: string[] = [];
  for (let index = 1; index <= Number(shares); index += 1) {
    collected.push(await page.getByLabel(`Share ${index}`, { exact: true }).inputValue());
  }
  return collected;
}

test('splits a secret and recovers it from a subset of the shares', async ({ page }) => {
  const shares = await split(page, SECRET, '3', '2');

  expect(shares).toHaveLength(3);
  for (const share of shares) {
    expect(share).toMatch(/^sss1-[A-Za-z0-9+/]+={0,2}$/);
  }
  expect(new Set(shares).size).toBe(3);

  // First and last, to prove any subset works rather than the first two.
  await page
    .getByLabel(field.shareInput, { exact: true })
    .fill(`${shares[0]!}\n${shares[2]!}`);
  await page.getByRole('button', { name: 'Recover secret', exact: true }).click();

  await expect(page.getByLabel(field.recovered, { exact: true })).toHaveValue(SECRET);
});

test('recovers from more shares than the threshold too', async ({ page }) => {
  const shares = await split(page, 'a simpler secret', '4', '2');

  await page.getByLabel(field.shareInput, { exact: true }).fill(shares.join('\n'));
  await page.getByRole('button', { name: 'Recover secret', exact: true }).click();

  await expect(page.getByLabel(field.recovered, { exact: true })).toHaveValue('a simpler secret');
});

test('tolerates shares that were wrapped or indented in transit', async ({ page }) => {
  const shares = await split(page, 'pasted from an email', '3', '2');
  const mangled = shares
    .slice(0, 2)
    .map((share) => `   ${share.slice(0, 14)} ${share.slice(14)}  `)
    .join('\r\n');

  await page.getByLabel(field.shareInput, { exact: true }).fill(mangled);
  await page.getByRole('button', { name: 'Recover secret', exact: true }).click();

  await expect(page.getByLabel(field.recovered, { exact: true })).toHaveValue(
    'pasted from an email',
  );
});

test('keeps nothing at all after a reload', async ({ page }) => {
  await split(page, SECRET, '3', '2');
  await expect(page.getByLabel('Share 1', { exact: true })).toBeVisible();

  await page.reload();

  await expect(page.getByLabel(field.secret, { exact: true })).toHaveValue('');
  await expect(page.getByLabel(field.shareInput, { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Share 1', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel(field.recovered, { exact: true })).toHaveCount(0);

  const stored = await page.evaluate(() => {
    const count = (read: () => number): number | 'blocked' => {
      try {
        return read();
      } catch {
        return 'blocked';
      }
    };
    return {
      local: count(() => localStorage.length),
      session: count(() => sessionStorage.length),
      cookies: document.cookie,
    };
  });

  expect([0, 'blocked']).toContain(stored.local);
  expect([0, 'blocked']).toContain(stored.session);
  expect(stored.cookies).toBe('');
});

test('warns about large secrets without blocking them', async ({ page }) => {
  await page.getByLabel(field.secret, { exact: true }).fill('x'.repeat(5000));
  await expect(page.getByText(/This secret is 4\.9 KB/)).toBeVisible();

  await page.getByRole('button', { name: 'Split secret', exact: true }).click();
  await expect(page.getByLabel('Share 1', { exact: true })).toBeVisible();
});
