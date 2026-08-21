import { corruptShare, expect, field, test } from './fixtures';

test('refuses a threshold above the share count before generating anything', async ({ page }) => {
  await page.getByLabel(field.secret, { exact: true }).fill('nope');
  await page.getByLabel(field.shareCount, { exact: true }).fill('3');
  await page.getByLabel(field.threshold, { exact: true }).fill('5');
  await page.getByRole('button', { name: 'Split secret', exact: true }).click();

  await expect(page.getByRole('alert')).toContainText(
    'Threshold cannot be greater than the number of shares.',
  );
  await expect(page.getByLabel('Share 1', { exact: true })).toHaveCount(0);
});

test('refuses an empty secret', async ({ page }) => {
  await page.getByRole('button', { name: 'Split secret', exact: true }).click();

  await expect(page.getByRole('alert')).toContainText('Enter a secret to split.');
  await expect(page.getByLabel('Share 1', { exact: true })).toHaveCount(0);
});

test('reports a clear failure below the threshold instead of a wrong secret', async ({ page }) => {
  await page.getByLabel(field.secret, { exact: true }).fill('a secret worth protecting');
  await page.getByLabel(field.shareCount, { exact: true }).fill('5');
  await page.getByLabel(field.threshold, { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Split secret', exact: true }).click();

  const first = await page.getByLabel('Share 1', { exact: true }).inputValue();
  const second = await page.getByLabel('Share 2', { exact: true }).inputValue();

  await page.getByLabel(field.shareInput, { exact: true }).fill(`${first}\n${second}`);
  await page.getByRole('button', { name: 'Recover secret', exact: true }).click();

  await expect(page.getByRole('alert')).toContainText('Could not recover a valid secret');
  await expect(page.getByLabel(field.recovered, { exact: true })).toHaveCount(0);
});

test('rejects a corrupted share', async ({ page }) => {
  await page.getByLabel(field.secret, { exact: true }).fill('a secret worth protecting');
  await page.getByRole('button', { name: 'Split secret', exact: true }).click();

  const first = await page.getByLabel('Share 1', { exact: true }).inputValue();
  const second = await page.getByLabel('Share 2', { exact: true }).inputValue();

  await page
    .getByLabel(field.shareInput, { exact: true })
    .fill(`${corruptShare(first)}\n${second}`);
  await page.getByRole('button', { name: 'Recover secret', exact: true }).click();

  await expect(page.getByRole('alert')).toContainText('Could not recover a valid secret');
  await expect(page.getByLabel(field.recovered, { exact: true })).toHaveCount(0);
});

test('names the line a malformed share is on', async ({ page }) => {
  await page.getByLabel(field.secret, { exact: true }).fill('hello');
  await page.getByRole('button', { name: 'Split secret', exact: true }).click();
  const first = await page.getByLabel('Share 1', { exact: true }).inputValue();

  await page.getByLabel(field.shareInput, { exact: true }).fill(`${first}\nnot-a-share`);
  await page.getByRole('button', { name: 'Recover secret', exact: true }).click();

  await expect(page.getByRole('alert')).toContainText(
    'Line 2 is not a valid share: A share must start with "sss1-".',
  );
});

test('says when the same share was pasted twice', async ({ page }) => {
  await page.getByLabel(field.secret, { exact: true }).fill('hello');
  await page.getByRole('button', { name: 'Split secret', exact: true }).click();
  const first = await page.getByLabel('Share 1', { exact: true }).inputValue();

  await page.getByLabel(field.shareInput, { exact: true }).fill(`${first}\n${first}`);
  await page.getByRole('button', { name: 'Recover secret', exact: true }).click();

  await expect(page.getByRole('alert')).toContainText('The same share appears more than once');
});

test('asks for more shares when given only one', async ({ page }) => {
  await page.getByLabel(field.secret, { exact: true }).fill('hello');
  await page.getByRole('button', { name: 'Split secret', exact: true }).click();
  const first = await page.getByLabel('Share 1', { exact: true }).inputValue();

  await page.getByLabel(field.shareInput, { exact: true }).fill(first);
  await page.getByRole('button', { name: 'Recover secret', exact: true }).click();

  await expect(page.getByRole('alert')).toContainText('Paste at least 2 shares, one per line.');
});

test('clears a previous error once the input is fixed', async ({ page }) => {
  await page.getByRole('button', { name: 'Split secret', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Enter a secret to split.');

  await page.getByLabel(field.secret, { exact: true }).fill('now there is one');
  await page.getByRole('button', { name: 'Split secret', exact: true }).click();

  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByLabel('Share 1', { exact: true })).toBeVisible();
});
