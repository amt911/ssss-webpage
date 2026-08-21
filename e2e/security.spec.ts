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

  // The inline blocks are pinned by hash, so the policy is an integrity check on
  // this exact artifact rather than a licence for any inline script.
  expect(policies[0]).toMatch(/script-src 'sha256-[A-Za-z0-9+/]+='/);
  expect(policies[0]).toMatch(/style-src 'sha256-[A-Za-z0-9+/]+='/);
  expect(policies[0]).not.toContain('unsafe-inline');
  expect(policies[0]).not.toContain('unsafe-eval');
});

test('the hashed policy actually runs the page rather than blocking it', async ({ page }) => {
  // A wrong hash would leave a page that renders and does nothing, so prove both
  // the script and the stylesheet were accepted by the browser.
  await expect(page.getByRole('button', { name: 'Split secret', exact: true })).toBeVisible();

  const styled = await page.evaluate(
    () => getComputedStyle(document.body).fontFamily.length > 0
      && getComputedStyle(document.querySelector('.card')!).borderRadius !== '0px',
  );
  expect(styled).toBe(true);

  await page.getByLabel(field.secret, { exact: true }).fill('the script is alive');
  await page.getByRole('button', { name: 'Split secret', exact: true }).click();
  await expect(page.getByLabel('Share 1', { exact: true })).toBeVisible();
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

test('a native form submit cannot carry the secret anywhere, not even into a log', async ({
  page,
  guards,
}) => {
  // If initApp ever fails to attach its handlers — one renamed id is enough —
  // the browser performs a native submit. form-action 'none' blocks the
  // navigation, but Chromium logs the blocked URL, and a named control would put
  // the secret in it. This asserts the controls stay nameless.
  guards.allowConsoleError(/Content Security Policy|form-action/i);

  const canary = 'CANARY-do-not-log-me-42';
  await page.getByLabel(field.secret, { exact: true }).fill(canary);

  const named = await page.evaluate(() =>
    [...document.querySelectorAll('input, textarea, select, button')]
      .map((node) => node.getAttribute('name'))
      .filter((name) => name !== null),
  );
  expect(named).toEqual([]);

  const before = page.url();
  // Caught in the page: Firefox rejects the blocked submit with an exception that
  // does not survive serialisation, and either outcome is fine here — what
  // matters is that the URL does not change and nothing logs the secret.
  await page.evaluate(() => {
    try {
      (document.getElementById('split-form') as HTMLFormElement).submit();
    } catch {
      /* blocked before it began, which is the desired outcome */
    }
  });
  await page.waitForTimeout(300);

  expect(page.url()).toBe(before);
  expect(guards.consoleErrors.join('\n')).not.toContain(canary);
  expect(guards.remoteRequests).toEqual([]);
});

test('opts out of browser translation, which runs outside the CSP', async ({ page }) => {
  const optOut = await page.evaluate(() => ({
    root: document.documentElement.translate,
    meta: document.querySelector('meta[name="google"]')?.getAttribute('content') ?? null,
  }));

  expect(optOut.root).toBe(false);
  expect(optOut.meta).toBe('notranslate');
});

test('loads no external resource of any kind', async ({ page }) => {
  const externals = await page.evaluate(() => {
    // Every attribute a browser dereferences, not just src and href: a ping or a
    // formaction needs no script and carries data in its URL.
    const attributes = [
      'href',
      'src',
      'srcset',
      'ping',
      'action',
      'formaction',
      'poster',
      'data',
      'background',
      'cite',
      'manifest',
      'longdesc',
    ];
    return [...document.querySelectorAll('*')]
      .flatMap((node) => attributes.map((name) => node.getAttribute(name)))
      .filter((value): value is string => value !== null)
      .filter((value) => !/^\s*(?:data:|#)/i.test(value));
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
