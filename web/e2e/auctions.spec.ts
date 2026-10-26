import { expect, test } from '@playwright/test';
import { logIn, PNG } from './helpers';

const lotLinks = 'a[href^="/auctions/"]';

test('visitors can browse and filter live auctions', async ({ page }) => {
  await page.goto('/auctions');
  await expect(page.getByRole('heading', { name: /The room\s+is live/ })).toBeVisible();

  await page.getByLabel('Search lots').fill('Stratocaster');
  await page.waitForURL(/q=Stratocaster/);
  await expect(page.locator(lotLinks).first()).toBeVisible();
  await page.locator(lotLinks).first().click();
  await page.waitForURL(/\/auctions\/\d+$/);
  await expect(page.getByRole('heading', { name: /Stratocaster/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /log in to bid/i }).first()).toBeVisible();
});

test('bids appear instantly for everyone watching the auction', async ({ browser }) => {
  const bidder = await (await browser.newContext()).newPage();
  const watcher = await (await browser.newContext()).newPage();
  await logIn(bidder, 'maya@bidnest.test');

  await watcher.goto('/auctions?q=Stratocaster');
  await watcher.locator(lotLinks).first().click();
  await watcher.waitForURL(/\/auctions\/\d+$/);
  await expect(watcher.getByRole('heading', { name: /Stratocaster/ })).toBeVisible();

  await bidder.goto(watcher.url());
  const placeBid = bidder.getByRole('button', { name: /Place bid · \$/ }).first();
  const label = (await placeBid.textContent()) ?? '';
  const amount = label.split('·')[1]!.trim();
  await placeBid.click();
  await bidder.getByRole('button', { name: 'Confirm bid' }).click();
  await expect(bidder.getByText('Bid placed').first()).toBeVisible();

  await expect(watcher.getByText(amount).first()).toBeVisible({ timeout: 10_000 });
});

test('signed-out visitors are sent to login for protected pages', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
});

test('a listing created by a seller is approved by an admin and goes live', async ({ browser }) => {
  const title = `E2E vintage camera ${Date.now()}`;
  const sellerContext = await browser.newContext();
  const loginResponse = await sellerContext.request.post('/api/auth/login', { data: { email: 'omar@bidnest.test', password: process.env.SEED_PASSWORD ?? 'BidNest123!' } });
  expect(loginResponse.ok()).toBe(true);
  const created = await sellerContext.request.post('/api/seller/items', {
    multipart: { title, description: 'Created by the end-to-end test.', minBid: '25', durationDays: '7', condition: 'Good', images: { name: 'camera.png', mimeType: 'image/png', buffer: PNG } },
  });
  expect(created.status()).toBe(201);

  const admin = await (await browser.newContext()).newPage();
  await logIn(admin, 'admin@bidnest.test');
  await admin.goto('/admin/approvals');
  await admin.getByText(title).first().click();
  await admin.getByRole('button', { name: 'Approve' }).click();
  await expect(admin.getByText(/approved/i).first()).toBeVisible();

  await admin.goto(`/auctions?q=${encodeURIComponent(title)}`);
  await expect(admin.getByText(title).first()).toBeVisible();
});

test('regular users cannot open the admin console', async ({ page }) => {
  await logIn(page, 'maya@bidnest.test');
  await page.goto('/admin');
  await expect(page.getByText("You don't have access to this page")).toBeVisible();
});

test('a seller can save a draft, find it under Drafts and discard it', async ({ page }) => {
  const title = `E2E draft lot ${Date.now()}`;
  await logIn(page, 'maya@bidnest.test');
  await page.goto('/sell/new');
  await page.getByPlaceholder(/Maker, model, year/).fill(title);
  await page.getByRole('button', { name: 'Save draft' }).click();
  await page.waitForURL(/\/sell\?status=draft/);
  await expect(page.getByText(title).first()).toBeVisible();
  await expect(page.getByText('Not submitted').first()).toBeVisible();

  await page.getByRole('button', { name: /more|actions|menu/i }).first().click();
  await page.getByRole('menuitem', { name: 'Discard draft' }).click();
  await page.getByRole('button', { name: 'Delete listing' }).click();
  await expect(page.getByText(title)).toHaveCount(0);
});
