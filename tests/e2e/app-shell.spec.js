import { expect, test } from '@playwright/test';

const unexpectedApiRequests = new WeakMap();

async function mockBackend(page, unexpectedRequests) {
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

    if (url.pathname === '/api/courses' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          courses: [{ courseId: 'PRO192', courseName: 'Object-Oriented Programming' }],
        }),
      });
      return;
    }

    const explicitGetContracts = {
      '/api/students/student-1/dashboard': { studentId: 'student-1', courseId: 'PRO192' },
      '/api/ai/conversations': { conversations: [] },
      '/api/courses/PRO192/materials': { materials: [] },
      '/api/students/student-1/assignments': {
        assignments: [{
          id: 'assignment-1',
          title: 'E2E Assignment',
          courseId: 'PRO192',
          classId: 'SE1833',
          assignmentType: 'ASSIGNMENT',
          targetType: 'ALL_CLASS',
        }],
      },
      '/api/students/student-1/submissions': { submissions: [] },
      '/api/tutor/students/student-1/courses/PRO192/memory': {},
      '/api/tutor/students/student-1/courses/PRO192/quizzes': { quizzes: [] },
      '/api/tutor/students/student-1/courses/PRO192/quiz-assignments': { assignments: [] },
      '/api/tutor/escalations/history': { escalations: [] },
      '/api/students/student-1/improve-plans': { content: [] },
      '/api/students/student-1/courses/PRO192/improve-plan': {},
      '/api/admin/dashboard/stats': {},
      '/api/harness/logs': { logs: [] },
      '/api/admin/users': { users: [] },
      '/api/admin/mentors': { mentors: [] },
      '/api/admin/mentor-escalations': { escalations: [] },
      '/api/tutor/answer-reviews': { reviews: [] },
      '/api/tutor/answer-reviews/senior-pending': { reviews: [] },
      '/api/tutor/escalations/knowledge-candidates': { candidates: [] },
      '/api/admin/semesters': { semesters: [] },
      '/api/mentors': { mentors: [] },
      '/api/v2/expert-training/coverage-gaps': { gaps: [] },
      '/api/v2/expert-training/tasks': { tasks: [] },
      '/api/v2/expert-training/gold-qa': { content: [] },
      '/api/v2/expert-training/rubrics': { content: [] },
      '/api/v2/expert-training/eval-runs': { runs: [] },
    };
    if (request.method() === 'GET' && Object.hasOwn(explicitGetContracts, url.pathname)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(explicitGetContracts[url.pathname]),
      });
      return;
    }

    unexpectedRequests.push(`${request.method()} ${url.pathname}${url.search}`);
    await route.fulfill({
      status: 501,
      contentType: 'application/json',
      body: JSON.stringify({ message: `Unhandled E2E API route: ${request.method()} ${url.pathname}` }),
    });
  });
}

async function signIn(page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('student@example.com');
  await page.getByLabel('Mật khẩu').fill('secret1');
  await page.locator('.login-submit').click();
  await expect(page).toHaveURL(/\/student\/chat$/);
}

async function signInAsAdmin(page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@example.com');
  await page.getByLabel('Mật khẩu').fill('secret1');
  await page.locator('.login-submit').click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

test.beforeEach(async ({ page }) => {
  const unexpectedRequests = [];
  unexpectedApiRequests.set(page, unexpectedRequests);
  await mockBackend(page, unexpectedRequests);
});

test.afterEach(async ({ page }) => {
  expect([...new Set(unexpectedApiRequests.get(page) || [])], 'Every E2E API request must have an explicit mock contract').toEqual([]);
});

test('student login resolves enrollment context and supports dark mode', async ({ page }) => {
  await signIn(page);
  await expect(page.getByText('Trò chuyện với AI Tutor', { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel('Lớp đã ghi danh')).toContainText('SE1833');

  await page.getByRole('switch', { name: 'Dùng giao diện tối' }).click();
  await expect(page.locator('.app-container')).toHaveClass(/dark/);
  await expect(page.getByRole('switch', { name: 'Dùng giao diện sáng' })).toBeVisible();
});

test('student materials remains readable in dark mode', async ({ page }) => {
  await signIn(page);
  await page.goto('/student/materials');
  await expect(page.getByRole('cell', { name: 'E2E Assignment', exact: true })).toBeVisible();

  await page.getByRole('switch', { name: 'Dùng giao diện tối' }).click();
  await expect(page.locator('.student-materials-page')).toBeVisible();
  await expect(page.locator('.student-materials-context')).toHaveCSS('background-color', 'rgb(23, 23, 23)');
  await expect(page.locator('.student-materials-page .ant-table-thead th').first()).toHaveCSS('color', 'rgb(243, 244, 246)');
  await expect(page.getByRole('tab', { name: 'Bài tập được giao' })).toHaveCSS('color', 'rgb(251, 146, 60)');
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

test('long AI markdown does not add horizontal scrolling to the chat viewport', async ({ page }) => {
  await page.route('**/api/ai/conversations?*', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations: [{
          conversationId: 'conversation-wide',
          title: 'Wide markdown answer',
          courseId: 'PRO192',
          classId: 'SE1833',
          messageCount: 2,
          userQuestionCount: 1,
          lastMessageAt: '2026-07-20T08:00:00Z',
        }],
      }),
    });
  });
  await page.route('**/api/ai/conversations/conversation-wide/messages?*', async (route) => {
    const wideTable = `| ${Array.from({ length: 8 }, (_, index) => `Column ${index + 1}`).join(' | ')} |\n| ${Array.from({ length: 8 }, () => '---').join(' | ')} |\n| ${Array.from({ length: 8 }, () => 'A very long table value').join(' | ')} |`;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          { id: 'user-wide', role: 'USER', content: `Explain ${'long-topic-'.repeat(35)}` },
          {
            id: 'assistant-wide',
            role: 'ASSISTANT',
            content: `# Long content\n\nhttps://example.com/${'unbroken-path-'.repeat(40)}\n\n${wideTable}\n\n\`\`\`javascript\nconst value = "${'long-code-value-'.repeat(45)}";\n\`\`\``,
            mode: 'RAG',
          },
        ],
      }),
    });
  });
  await page.route('**/api/ai/conversations/conversation-wide/pinned-messages?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });

  await signIn(page);
  const conversationTitle = page.getByText('Wide markdown answer', { exact: true });
  if (page.viewportSize().width <= 760) {
    await page.getByRole('button', { name: 'Chat history' }).click();
  }
  await expect(conversationTitle).toBeVisible();
  await conversationTitle.click();
  await expect(page.getByText('Long content', { exact: true })).toBeVisible();

  const dimensions = await page.locator('.chat-workspace-messages-container').evaluate((node) => {
    const containerRect = node.getBoundingClientRect();
    const overflowing = [...node.querySelectorAll('*')]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          className: typeof element.className === 'string' ? element.className : '',
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        };
      })
      .filter((item) => item.right > containerRect.right + 1 || item.left < containerRect.left - 1)
      .slice(0, 12);
    return {
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth,
      overflowing,
    };
  });
  expect(dimensions.scrollWidth, JSON.stringify(dimensions.overflowing, null, 2))
    .toBeLessThanOrEqual(dimensions.clientWidth + 1);

  const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(pageOverflow).toBeLessThanOrEqual(1);
});

test('empty chat keeps the robot inside the visible message viewport', async ({ page }) => {
  await signIn(page);

  const messagePanel = page.locator('.chat-workspace-messages-container');
  const mascot = page.locator('.chat-empty-mascot');
  await expect(messagePanel).toBeVisible();
  await expect(mascot).toBeVisible();
  await expect.poll(() => messagePanel.evaluate((node) => node.scrollTop)).toBe(0);

  const panelBounds = await messagePanel.boundingBox();
  const mascotBounds = await mascot.boundingBox();
  expect(panelBounds).not.toBeNull();
  expect(mascotBounds).not.toBeNull();
  expect(mascotBounds.y).toBeGreaterThanOrEqual(panelBounds.y);
  expect(mascotBounds.y + mascotBounds.height).toBeLessThanOrEqual(panelBounds.y + panelBounds.height + 1);
});

test('learning progress uses an actionable plan without canvas overflow', async ({ page }) => {
  await signIn(page);
  await page.goto('/student/progress');

  const actionPlan = page.locator('.learning-action-plan-card');
  await expect(page.getByText('Kế hoạch học theo môn', { exact: true })).toBeVisible();
  await actionPlan.scrollIntoViewIfNeeded();
  const planBounds = await actionPlan.boundingBox();
  expect(planBounds).not.toBeNull();
  expect(planBounds.x).toBeGreaterThanOrEqual(0);
  expect(planBounds.x + planBounds.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
  await expect(page.locator('#knowledge-graph-canvas')).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('practice quiz tabs stay inside the viewport and remain navigable', async ({ page }) => {
  await signIn(page);
  await page.goto('/student/quizzes');

  const quizTabs = page.locator('.quiz-tabs');
  await expect(quizTabs).toBeVisible();
  await expect(quizTabs.getByRole('tab')).toHaveCount(5);

  const navBounds = await quizTabs.locator(':scope > .ant-tabs-nav').boundingBox();
  expect(navBounds).not.toBeNull();
  expect(navBounds.x).toBeGreaterThanOrEqual(0);
  expect(navBounds.x + navBounds.width).toBeLessThanOrEqual(page.viewportSize().width + 1);

  const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(pageOverflow).toBeLessThanOrEqual(1);

  await quizTabs.getByRole('tab', { name: /^Lịch sử/ }).click();
  await expect(quizTabs.getByRole('tab', { name: /^Lịch sử/ })).toHaveAttribute('aria-selected', 'true');
});

test('admin routes load their independent feature pages', async ({ page }) => {
  await signInAsAdmin(page);
  await expect(page.getByRole('heading', { name: 'Tổng quan hệ thống' })).toBeVisible();

  await page.goto('/admin/users');
  await expect(page.getByText(/Tài khoản \(0\)/)).toBeVisible();

  await page.goto('/admin/academic');
  await expect(page.getByRole('tab', { name: 'Học kỳ' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Học liệu môn học' })).toBeVisible();

  await page.goto('/admin/review-queue');
  await expect(page.getByRole('heading', { name: 'Kiểm duyệt phản hồi & tri thức AI' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Đã xử lý/ })).toBeVisible();
});

test('Tutor V2 admin route loads role-gated workflow without viewport overflow', async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto('/admin/expert-training');

  await expect(page.getByRole('heading', { name: 'Huấn luyện tri thức AI' })).toBeVisible();
  await expect(
    page.getByText('PRO192 · Object-Oriented Programming', { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Tổng quan' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Công việc' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Nội dung & kiểm duyệt' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Phân tích độ phủ' })).toBeVisible();
  await page.getByRole('switch', { name: 'Dùng giao diện tối' }).click();
  await expect(page.locator('.scope-bar')).toHaveCSS('background-color', 'rgb(15, 15, 15)');

  await page.getByRole('tab', { name: 'Công việc' }).click();
  await expect(page).toHaveURL(/\/admin\/expert-training\?view=work$/);
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Công việc' })).toHaveAttribute('aria-selected', 'true');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
