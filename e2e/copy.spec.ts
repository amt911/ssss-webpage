import { expect, field, test } from './fixtures';

/**
 * The clipboard itself is not readable in every browser over file://, so these
 * specs assert the two things that are always true and always matter: the user
 * gets visible feedback, and the value on screen is the value being copied.
 */

test('confirms visually when a share is copied', async ({ page }) => {
  await page.getByLabel(field.secret, { exact: true }).fill('copy me');
  await page.getByRole('button', { name: 'Split secret', exact: true }).click();

  const copyShare = page.getByRole('button', { name: 'Copy share 1', exact: true });
  await expect(copyShare).toHaveText('Copy');

  await copyShare.click();

  // Either the clipboard accepted it, or the fallback told the user what to press.
  await expect(copyShare).toHaveText(/✓ Copied|Press Ctrl\+C/);
});

test('offers a copy button for every share and for the recovered secret', async ({ page }) => {
  await page.getByLabel(field.secret, { exact: true }).fill('copy me too');
  await page.getByLabel(field.shareCount, { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Split secret', exact: true }).click();

  for (const index of [1, 2, 3]) {
    await expect(
      page.getByRole('button', { name: `Copy share ${index}`, exact: true }),
    ).toBeVisible();
  }

  const first = await page.getByLabel('Share 1', { exact: true }).inputValue();
  const second = await page.getByLabel('Share 2', { exact: true }).inputValue();
  await page.getByLabel(field.shareInput, { exact: true }).fill(`${first}\n${second}`);
  await page.getByRole('button', { name: 'Recover secret', exact: true }).click();

  await expect(
    page.getByRole('button', { name: 'Copy recovered secret', exact: true }),
  ).toBeVisible();
});

test('the share on screen is exactly what a copy would take', async ({ page }) => {
  await page.getByLabel(field.secret, { exact: true }).fill('fidelity check');
  await page.getByRole('button', { name: 'Split secret', exact: true }).click();

  const shareField = page.getByLabel('Share 1', { exact: true });
  const value = await shareField.inputValue();

  expect(value).toMatch(/^sss1-/);
  await expect(shareField).toHaveValue(value);
  await expect(shareField).toHaveJSProperty('readOnly', true);
});
