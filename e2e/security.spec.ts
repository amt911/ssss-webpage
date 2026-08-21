import { expect, field, test } from './fixtures';

test('works with networking switched off', async ({ page, context }) => {
  await context.setOffline(true);

  await page.getByLabel(field.secret, { exact: true }).fill('offline and fine');
  await page.getByRole('button', { name: 'Split secret', exact: true }).click();

  const first = await page.getByLabel('Share 1', { exact: true }).inputValue();
  const second = await page.getByLabel('Share 2', { exact: true }).inputValue();

  await page.getByLabel(field.shareInput, { exact: true }).fill(`${first}\n${second}`);
  await page.getByRole('button', { name: 'Recover secret', exact: true }).click();

  await expect(page.getByLabel(field.recovered, { exact: true })).toHaveValue('offline and fine');
});

test('ships exactly one Content-Security-Policy meta tag', async ({ page }) => {
  const policies = await page.evaluate(() =>
    [...document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]')].map(
      (node) => node.getAttribute('content') ?? '',
    ),
  );

  expect(policies).toHaveLength(1);
  expect(policies[0]).toContain("default-src 'none'");
  expect(policies[0]).toContain("base-uri 'none'");
  expect(policies[0]).toContain("form-action 'none'");
});

test('the CSP blocks an outbound request even if code tries to make one', async ({
  page,
  guards,
}) => {
  // This test provokes the one request the suite is allowed to see. It never
  // reaches the network — the CSP rejects it first — but the attempt and the
  // browser's violation message would otherwise trip the standing guards.
  guards.allowRemoteRequest(/example\.com/);
  guards.allowConsoleError(/Content Security Policy|NetworkError|Failed to fetch|blocked/i);

  const outcome = await page.evaluate(async () => {
    try {
      await fetch('https://example.com/canary');
      return 'sent';
    } catch {
      return 'blocked';
    }
  });

  expect(outcome).toBe('blocked');
});

test('loads no external resource of any kind', async ({ page }) => {
  const externals = await page.evaluate(() => {
    const attributes = ['src', 'href'];
    return [...document.querySelectorAll('*')]
      .flatMap((node) => attributes.map((name) => node.getAttribute(name)))
      .filter((value): value is string => value !== null)
      .filter((value) => !value.startsWith('data:') && !value.startsWith('#'));
  });

  expect(externals).toEqual([]);
});

test('keeps the crypto it needs and none of the crypto it must not use', async ({ page }) => {
  const available = await page.evaluate(() => ({
    getRandomValues: typeof crypto?.getRandomValues,
    // Undefined over file:// in Chrome. Nothing in this page may depend on it.
    subtleUsed: document.documentElement.innerHTML.includes('crypto.subtle'),
  }));

  expect(available.getRandomValues).toBe('function');
  expect(available.subtleUsed).toBe(false);
});
