import type { Browser, Page } from '@playwright/test';

export const logIn = async (page: Page, email: string) => {
  const response = await page.context().request.post('/api/auth/dev-login', { data: { email } });
  if (!response.ok()) throw new Error(`Login failed for ${email}`);
};

export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

export const apiLogin = async (browser: Browser, email: string) => {
  const context = await browser.newContext();
  const response = await context.request.post('/api/auth/dev-login', { data: { email } });
  if (!response.ok()) throw new Error(`Login failed for ${email}`);
  return context;
};

export const createLiveItem = async (browser: Browser, title: string, minBid = 25) => {
  const seller = await apiLogin(browser, 'omar@bidnest.test');
  const created = await seller.request.post('/api/seller/items', {
    multipart: { title, description: 'Created by the end-to-end test.', minBid: String(minBid), durationDays: '7', condition: 'Good', images: { name: 'item.png', mimeType: 'image/png', buffer: PNG } },
  });
  const { id } = (await created.json()).data as { id: number };
  const admin = await apiLogin(browser, 'admin@bidnest.test');
  await admin.request.post(`/api/admin/approvals/${id}/approve`, { data: {} });
  return id;
};
