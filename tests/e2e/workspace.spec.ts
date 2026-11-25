import { expect, test } from '@playwright/test';

test('template workspace navigation, theme persistence, and notices work without errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });

  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Học phần', exact: true })).toBeVisible();

  // Homepage unofficial content disclaimer notice
  const homeNotice = page.getByRole('note', { name: 'Lưu ý về nguồn nội dung' });
  await expect(homeNotice).toBeVisible();
  await expect(homeNotice).toContainText('không phải tài liệu chính thức');

  // Subtle header info popover & footer disclaimer
  const infoTrigger = page.getByRole('button', { name: 'Lưu ý về nguồn nội dung' });
  await expect(infoTrigger).toBeVisible();
  await infoTrigger.click();
  await expect(page.getByRole('note', { name: 'Thông tin lưu ý về nội dung' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('note', { name: 'Thông tin lưu ý về nội dung' })).toBeHidden();
  await expect(page.locator('footer')).toContainText('không thể thay thế giảng viên trên lớp và giáo trình');

  // Courses page renders cleanly with 0 courses
  await page.goto('./#/courses');
  await expect(page.getByRole('heading', { name: 'Danh mục học phần' })).toBeVisible();

  // Exam practice page renders clean empty state with 0 courses
  await page.goto('./#/exams');
  await expect(page.getByRole('heading', { name: 'Chưa có học phần để tạo đề luyện' })).toBeVisible();

  // Legacy /resources redirects smoothly to homepage
  await page.goto('./#/resources');
  await expect(page.getByRole('heading', { name: 'Học phần', exact: true })).toBeVisible();

  // Learning Progress empty state
  await page.goto('./#/progress');
  await expect(page.getByRole('heading', { name: 'Tiến độ học tập', exact: true })).toBeVisible();
  await expect(page.getByText('Chưa có dữ liệu tiến độ học tập')).toBeVisible();

  // Settings + dark theme toggle & persistence
  await page.goto('./#/settings');
  await expect(page.getByRole('heading', { name: 'Cài đặt không gian học' })).toBeVisible();
  await page.getByRole('radio', { name: /Tối/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  expect(errors).toEqual([]);
});

test('has no horizontal overflow across representative viewport widths', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('hus-learning-hub:small-screen-ack:v1', '1');
  });
  const widths = [360, 390, 768, 1024, 1440];
  const routes = ['./', './#/courses', './#/exams', './#/progress', './#/settings'];

  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of routes) {
      await page.goto(route);
      await expect(page.getByRole('main')).toBeVisible();
      const noOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
      expect(noOverflow, `Horizontal overflow at ${width}px on ${route}`).toBe(true);
    }
  }
});

test('mobile navigation drawer opens, navigates, and closes cleanly', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('hus-learning-hub:small-screen-ack:v1', '1');
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('./');
  await page.getByRole('button', { name: 'Mở thanh điều hướng' }).click();
  const dialog = page.getByRole('dialog', { name: 'Điều hướng' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('link', { name: 'Tiến độ' }).click();
  await expect(page.getByRole('heading', { name: 'Tiến độ học tập', exact: true })).toBeVisible();
  await expect(dialog).not.toBeVisible();
});

test('small-screen popup requires confirmation on phones and does not show on desktop', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('./');
  await page.evaluate(() => window.localStorage.removeItem('hus-learning-hub:small-screen-ack:v1'));
  await page.reload();
  await expect(
    page.getByRole('dialog', { name: /tối ưu cho màn hình lớn/i }),
  ).toHaveCount(0);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  const dialog = page.getByRole('dialog', { name: /tối ưu cho màn hình lớn/i });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /Tôi đã hiểu/i }).click();
  await expect(dialog).toBeHidden();
});
