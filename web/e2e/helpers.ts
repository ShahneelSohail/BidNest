import type { Page } from '@playwright/test';

export const PASSWORD = process.env.SEED_PASSWORD ?? 'BidNest123!';

export const logIn = async (page: Page, email: string) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL(url => !url.pathname.startsWith('/login'));
};
