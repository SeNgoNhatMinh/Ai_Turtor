import { expect, test } from '@playwright/test';

async function mockBackend(page) {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === '/api/users/login') {
      const email = request.postDataJSON()?.email;
      const isAdmin = email === 'admin@example.com';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'e2e-token',
          id: isAdmin ? 'admin-1' : 'student-1',
          userId: isAdmin ? 'admin-1' : 'student-1',
          fullName: isAdmin ? 'E2E Admin' : 'E2E Student',
          email,
          role: isAdmin ? 'ADMIN' : 'STUDENT',
        }),
      });
      return;
    }

    if (url.pathname.includes('/students/student-1/enrollments')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          enrollments: [{
            id: 'enrollment-1',
            studentId: 'student-1',
            courseId: 'PRO192',
            courseName: 'Object-Oriented Programming',
            classId: 'SE1833',
            className: 'Class SE1833',
            status: 'ACTIVE',
          }],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: [], conversations: [], materials: [], assignments: [] }),
    });
  });
}

async function signIn(page) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('student@example.com');
  await page.getByLabel('Password').fill('secret1');
  await page.locator('.login-submit').click();
  await expect(page).toHaveURL(/\/student\/chat$/);
}

async function signInAsAdmin(page) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('admin@example.com');
  await page.getByLabel('Password').fill('secret1');
  await page.locator('.login-submit').click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
});

test('student login resolves enrollment context and supports dark mode', async ({ page }) => {
  await signIn(page);
  await expect(page.getByText('Trò chuyện với AI Tutor', { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel('Lớp đã ghi danh')).toContainText('SE1833');

  await page.getByRole('switch', { name: 'Use dark mode' }).click();
  await expect(page.locator('.app-container')).toHaveClass(/dark/);
  await expect(page.getByRole('switch', { name: 'Use light mode' })).toBeVisible();
});

test('main student workspace does not overflow the viewport', async ({ page }) => {
  await signIn(page);
  await expect.poll(async () => page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }))).toMatchObject({ width: page.viewportSize().width });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('admin routes load their independent feature pages', async ({ page }) => {
  await signInAsAdmin(page);
  await expect(page.getByText('System Diagnostics', { exact: true })).toBeVisible();

  await page.goto('/admin/users');
  await expect(page.getByText(/Users \(0\)/)).toBeVisible();

  await page.goto('/admin/academic');
  await expect(page.getByRole('tab', { name: 'Terms' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Course Materials' })).toBeVisible();
});
