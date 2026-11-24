import { expect, test } from '@playwright/test';

test('template catalogue, missing routes, and subpath refresh work cleanly with zero courses', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });

  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Học phần', exact: true })).toBeVisible();
  await expect(page.getByText('Chưa có học phần nào — sẵn sàng khởi tạo')).toBeVisible();

  await page.goto('./#/courses/unknown');
  await expect(page.getByRole('heading', { name: 'Không tìm thấy học phần' })).toBeVisible();

  await page.goto('./#/unknown');
  await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible();
  await page.getByRole('link', { name: 'Về danh sách học phần' }).click();
  await expect(page.getByRole('heading', { name: 'Học phần', exact: true })).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('shows a loading state while a page chunk is pending', async ({ page }) => {
  let release: () => void = () => {};
  const pending = new Promise<void>(resolve => {
    release = resolve;
  });
  await page.route(/\/assets\/CataloguePage-[^/]+\.js$/, async route => {
    await pending;
    await route.continue();
  });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  try {
    await expect(page.getByRole('status')).toHaveText('Đang tải nội dung…');
  } finally {
    release();
  }
  await expect(page.getByRole('heading', { name: 'Học phần', exact: true })).toBeVisible();
  await expect(page.getByRole('main')).toBeFocused();
  const skipLink = page.getByRole('link', { name: 'Đến nội dung chính' });
  await skipLink.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  expect(page.url()).not.toContain('main-content');
});

test('offers recovery when a lazy page fails to load', async ({ page }) => {
  await page.route(/\/assets\/CataloguePage-[^/]+\.js$/, route => route.abort());
  await page.goto('./');
  await expect(page.getByRole('alert')).toContainText('Không thể tải nội dung');
  await expect(page.getByRole('button', { name: 'Tải lại trang' })).toBeVisible();
});
