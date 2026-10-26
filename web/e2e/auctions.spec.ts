import { expect, test } from '@playwright/test';
import { apiLogin, createLiveItem, logIn, PNG } from './helpers';

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
  const sellerContext = await apiLogin(browser, 'omar@bidnest.test');
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

test('a buyer can follow up on a support thread and the admin sees it', async ({ browser }) => {
  const followUp = `Thanks, resubmitting now (${Date.now()})`;
  const buyer = await (await browser.newContext()).newPage();
  await logIn(buyer, 'kai@bidnest.test');
  await buyer.goto('/dashboard/support');
  await buyer.getByRole('button', { name: /Listing was rejected/ }).first().click();
  await buyer.getByLabel('Reply').fill(followUp);
  await buyer.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(buyer.getByText(followUp).first()).toBeVisible();

  const admin = await (await browser.newContext()).newPage();
  await logIn(admin, 'admin@bidnest.test');
  await admin.goto('/admin/messages');
  await admin.getByText('Listing was rejected').first().click();
  await expect(admin.getByText(followUp).first()).toBeVisible();
});

test('a maximum bid defends the lead against a rival bid', async ({ browser }) => {
  const itemId = await createLiveItem(browser, `E2E maximum bid lot ${Date.now()}`);
  const rival = await (await browser.newContext()).newPage();
  const bidder = await (await browser.newContext()).newPage();
  await logIn(bidder, 'noah@bidnest.test');
  await bidder.goto(`/auctions/${itemId}`);
  await bidder.getByLabel('Bid automatically up to a maximum').check();
  const placeBid = bidder.getByRole('button', { name: /Place bid · \$/ }).first();
  const minimum = Number(((await placeBid.textContent()) ?? '').split('$')[1]!.replace(/,/g, ''));
  await bidder.getByLabel('Maximum bid').fill(String(minimum + 500));
  await placeBid.click();
  await bidder.getByRole('button', { name: 'Confirm bid' }).click();
  await expect(bidder.getByText('Bid placed').first()).toBeVisible();

  await logIn(rival, 'kai@bidnest.test');
  await rival.goto(`/auctions/${itemId}`);
  await rival.getByRole('button', { name: /Place bid · \$/ }).first().click();
  await rival.getByRole('button', { name: 'Confirm bid' }).click();
  await expect(rival.getByText(/Outbid right away/)).toBeVisible();

  await bidder.reload();
  await expect(bidder.getByText(/You're the highest bidder/).first()).toBeVisible();
  await expect(bidder.getByText(`maximum $${(minimum + 500).toLocaleString('en-US')}.00`).first()).toBeVisible();
});

test('a member can upload a profile photo and remove it again', async ({ page }) => {
  await logIn(page, 'ivy@bidnest.test');
  await page.goto('/settings/profile');
  await page.getByLabel('Upload photo').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText('Photo updated.')).toBeVisible();
  await expect(page.locator('main img').first()).toBeVisible();
  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText('Photo removed.')).toBeVisible();
  await expect(page.getByLabel('Upload photo')).toBeAttached();
});
