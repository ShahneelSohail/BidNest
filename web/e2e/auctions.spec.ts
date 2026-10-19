import { expect, test } from '@playwright/test';
import { logIn } from './helpers';

test('visitors can browse and filter live auctions', async ({ page }) => {
  await page.goto('/auctions');
  await expect(page.getByRole('heading', { name: 'Browse auctions' })).toBeVisible();
  await expect(page.locator('a[href^="/auctions/"]').first()).toBeVisible();

  await page.getByPlaceholder('What are you looking for?').fill('Stratocaster');
  await expect(page.locator('a[href^="/auctions/"]')).toHaveCount(1);
  await page.locator('a[href^="/auctions/"]').first().click();
  await page.waitForURL(/\/auctions\/\d+$/);
  await expect(page.getByRole('heading', { name: /Stratocaster/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Log in to bid' })).toBeVisible();
});

test('bids appear instantly for everyone watching the auction', async ({ browser }) => {
  const bidder = await (await browser.newContext()).newPage();
  const watcher = await (await browser.newContext()).newPage();
  await logIn(bidder, 'maya@bidnest.test');

  await watcher.goto('/auctions?q=Stratocaster');
  await watcher.locator('a[href^="/auctions/"]').first().click();
  await watcher.waitForURL(/\/auctions\/\d+$/);
  await expect(watcher.getByRole('heading', { name: /Stratocaster/ })).toBeVisible();
  const url = watcher.url();

  await bidder.goto(url);
  const minimum = await bidder.getByLabel('Bid amount').getAttribute('min');
  const amount = Number(minimum) + 50;
  await bidder.getByLabel('Bid amount').fill(String(amount));
  await bidder.getByRole('button', { name: 'Place bid' }).click();
  await expect(bidder.getByText('You are the highest bidder.').first()).toBeVisible();

  const formatted = amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  await expect(watcher.getByText(formatted).first()).toBeVisible({ timeout: 10_000 });
});

test('signed-in users are sent to login for protected pages', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
});

test('sellers submit a listing and an admin approves it', async ({ browser }) => {
  const title = `E2E vintage camera ${Date.now()}`;
  const seller = await (await browser.newContext()).newPage();
  await logIn(seller, 'omar@bidnest.test');
  await seller.goto('/sell/new');
  await seller.getByLabel('Item name').fill(title);
  await seller.getByLabel('Description').fill('Created by the end-to-end test.');
  await seller.getByLabel('Starting bid (USD)').fill('25');
  await seller.getByRole('button', { name: 'Submit for approval' }).click();
  await expect(seller.getByText(title)).toBeVisible();
  await expect(seller.getByText('pending').first()).toBeVisible();

  const admin = await (await browser.newContext()).newPage();
  await logIn(admin, 'admin@bidnest.test');
  await admin.goto('/admin/approvals');
  const card = admin.locator('div').filter({ hasText: title }).filter({ has: admin.getByRole('button', { name: 'Approve' }) }).last();
  await card.getByRole('button', { name: 'Approve' }).click();
  await expect(admin.getByText('Listing approved.')).toBeVisible();

  await seller.goto('/auctions?q=' + encodeURIComponent(title));
  await expect(seller.getByText(title)).toBeVisible();
});

test('regular users cannot open the admin console', async ({ page }) => {
  await logIn(page, 'maya@bidnest.test');
  await page.goto('/admin');
  await expect(page.getByText("You don't have access to this page")).toBeVisible();
});
