import { expect, test } from '@playwright/test';

const unexpectedApiRequests = new WeakMap();

async function mockBackend(page, unexpectedRequests) {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === '/api/users/login') {
      const email = request.postDataJSON()?.email;
      const account = {
        'admin@example.com': {
          id: 'admin-1',
          fullName: 'E2E Admin',
          role: 'ADMIN',
        },
        'senior@example.com': {
          id: 'senior-1',
          fullName: 'E2E Senior',
          role: 'SENIOR_MENTOR',
        },
        'teacher@example.com': {
          id: 'teacher-1',
          fullName: 'E2E Teacher',
          role: 'TEACHER',
        },
      }[email] || {
        id: 'student-1',
        fullName: 'E2E Student',
        role: 'STUDENT',
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'e2e-token',
          id: account.id,
          userId: account.id,
          fullName: account.fullName,
          email,
          role: account.role,
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

    if (url.pathname === '/api/mentors/teacher-1/courses' && request.method() === 'GET') {
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
      '/api/students/student-1/dashboard': {
        studentId: 'student-1',
        courseId: 'PRO192',
        suggestions: [
          'Vì tài liệu không cung cấp thông tin về hướng đi của môn PRJ, hãy ôn lại các chủ đề còn yếu trước khi tạo quiz tự ôn.',
        ],
      },
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
      '/api/mentors/teacher-1/dashboard': {},
      '/api/teachers/teacher-1/classes': { classes: [] },
      '/api/admin/semesters': { semesters: [] },
      '/api/academic/courses/PRO192/class-sections': {
        classSections: [{
          classId: 'SE1840',
          courseId: 'PRO192',
          teacherId: 'teacher-1',
          teacherName: 'E2E Teacher',
          teacherEmail: 'teacher@example.com',
          status: 'ACTIVE',
        }],
      },
      '/api/mentors': { mentors: [] },
      '/api/v2/expert-training/chapters/suggested': {
        chapters: [{
          id: 'chapter-oop',
          chapterKey: 'object-oriented-programming',
          courseId: 'PRO192',
          title: 'Object-Oriented Programming',
          status: 'CONFIRMED',
          detectedFrom: 'PDF_BOOKMARK',
          materialHealth: 'MATERIAL_OK',
          chunkCount: 8,
          tocLevel: 1,
        }],
      },
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

async function signInAsTeacher(page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('teacher@example.com');
  await page.getByLabel('Mật khẩu').fill('secret1');
  await page.locator('.login-submit').click();
  await expect(page).toHaveURL(/\/teacher\/classes$/);
}

async function signInAsSenior(page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('senior@example.com');
  await page.getByLabel('Mật khẩu').fill('secret1');
  await page.locator('.login-submit').click();
  await expect(page).toHaveURL(/\/senior\/review$/);
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

  await page.goto('/student/progress');
  await expect(page.getByRole('heading', { name: 'Tiến độ học tập' })).toHaveCSS('color', 'rgb(249, 250, 251)');
  await expect(page.locator('.page-subtitle')).toHaveCSS('color', 'rgb(209, 213, 219)');
});

test('student materials remains readable in dark mode', async ({ page }) => {
  await signIn(page);
  await page.goto('/student/materials');
  await expect(page.getByRole('cell', { name: 'E2E Assignment', exact: true })).toBeVisible();

  await page.getByRole('switch', { name: 'Dùng giao diện tối' }).click();
  await expect(page.locator('.student-materials-page')).toBeVisible();
  await expect(page.locator('.student-materials-context')).toHaveCSS('background-color', 'rgb(23, 23, 23)');
  await expect(page.locator('.student-materials-page .ant-table-thead th').first()).toHaveCSS('color', 'rgb(243, 244, 246)');
  await expect(page.getByRole('tab', { name: 'Bài tập được giao' })).toHaveCSS('color', 'rgb(255, 255, 255)');
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
    await page.getByRole('button', { name: 'Lịch sử chat' }).click();
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

test('student feature pages share the Practice Quiz header hierarchy', async ({ page }) => {
  await signIn(page);

  const pages = [
    ['/student/progress', 'Tiến độ học tập', 'Học tập cá nhân'],
    ['/student/quizzes', 'Luyện tập bằng quiz theo tài liệu môn học', 'Quiz luyện tập'],
    ['/student/materials', 'Tài liệu & bài tập', 'Học liệu & bài tập'],
    ['/student/mentor-review', 'Hỗ trợ từ giảng viên', 'Hỗ trợ học tập'],
  ];

  for (const [path, title, eyebrow] of pages) {
    await page.goto(path);
    const header = page.locator('.page-header');
    await expect(header).toBeVisible();
    await expect(header.getByRole('heading', { name: title })).toBeVisible();
    await expect(header.getByText(eyebrow, { exact: true })).toBeVisible();
    await expect(header).toHaveCSS('border-radius', '18px');

    const bounds = await header.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
  }

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

  const guideCard = page.locator('.quiz-guide-card');
  await expect(guideCard).toBeVisible();
  const guideBounds = await guideCard.boundingBox();
  expect(guideBounds).not.toBeNull();
  for (const child of await guideCard.locator('.quiz-step-list > div, .quiz-suggestion-strip button').all()) {
    const childBounds = await child.boundingBox();
    expect(childBounds).not.toBeNull();
    expect(childBounds.x).toBeGreaterThanOrEqual(guideBounds.x - 1);
    expect(childBounds.x + childBounds.width).toBeLessThanOrEqual(guideBounds.x + guideBounds.width + 1);
  }

  await quizTabs.getByRole('tab', { name: /^Lịch sử/ }).click();
  await expect(quizTabs.getByRole('tab', { name: /^Lịch sử/ })).toHaveAttribute('aria-selected', 'true');
});

test('admin routes load their independent feature pages', async ({ page }) => {
  await signInAsAdmin(page);
  await expect(page.getByRole('heading', { name: 'Tổng quan hệ thống' })).toBeVisible();
  await expect(page.locator('.page-header')).toHaveCSS('border-radius', '18px');

  await page.goto('/admin/users');
  await expect(page.getByText(/Tài khoản \(0\)/)).toBeVisible();
  await expect(page.locator('.page-header')).toHaveCSS('border-radius', '18px');

  await page.goto('/admin/academic');
  await expect(page.getByRole('tab', { name: 'Học kỳ' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Học liệu môn học' })).toBeVisible();
  await expect(page.locator('.page-header')).toHaveCSS('border-radius', '18px');

  await page.goto('/admin/review-queue');
  await expect(page.getByRole('heading', { name: 'Giám sát chất lượng AI' })).toBeVisible();
  await expect(page.getByText(/^Đã xử lý \(0\)$/)).toBeVisible();

  const qualityPageBounds = await page.locator('.quality-review-page').boundingBox();
  const qualityHeaderBounds = await page.locator('.quality-review-page > .page-header').boundingBox();
  const qualityWorkspaceBounds = await page.locator(
    '.quality-review-page > .answer-review-workspace',
  ).boundingBox();
  const expectedInset = page.viewportSize().width <= 768 ? 0 : 24;

  expect(qualityPageBounds).not.toBeNull();
  expect(qualityHeaderBounds).not.toBeNull();
  expect(qualityWorkspaceBounds).not.toBeNull();
  expect(Math.abs(qualityHeaderBounds.x - (qualityPageBounds.x + expectedInset)))
    .toBeLessThanOrEqual(1);
  expect(Math.abs(qualityWorkspaceBounds.x - qualityHeaderBounds.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(qualityWorkspaceBounds.width - qualityHeaderBounds.width)).toBeLessThanOrEqual(1);
});

test('Ant Design academic controls remain clickable around cards and anchored confirms', async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto('/admin/academic');

  const academicTabs = page.locator('.admin-academic-tabs .ant-tabs-tab');
  await expect(academicTabs).toHaveCount(6);

  await academicTabs.nth(2).click();
  const courseSelect = page.locator('.ant-tabs-tabpane-active .ant-select').last();
  await courseSelect.click();
  await expect(
    page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: 'PRO192' }),
  ).toBeVisible();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').first().click();
  await expect(page.getByText('Loading...', { exact: true })).toHaveCount(0);

  const classActionButton = page.locator(
    '.ant-tabs-tabpane-active .entity-action-button',
  ).first();
  await expect(classActionButton).toBeVisible();
  await classActionButton.scrollIntoViewIfNeeded();
  const classActionReceivesHit = await classActionButton.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const top = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    return top === button || button.contains(top);
  });
  expect(classActionReceivesHit).toBe(true);
  await classActionButton.click();
  await expect(page.locator('.ant-dropdown:visible')).toBeVisible();
  await page.keyboard.press('Escape');

  await academicTabs.nth(1).click();
  await page.locator('.entity-action-button').first().click();
  await page.locator('.ant-dropdown-menu-item-danger').click();

  const confirmOverlay = page.locator('.app-confirm-overlay');
  await expect(confirmOverlay).toHaveClass(/app-confirm-overlay--anchored/);
  await expect(confirmOverlay).toHaveCSS('pointer-events', 'none');

  // This click used to be intercepted by the transparent full-screen overlay.
  await page.locator('.ant-tabs-tabpane-active .ant-card-extra .ant-btn').click();
  await expect(page.locator('.app-confirm-card')).toBeVisible();
  await page.locator('.app-confirm-card__btn').first().click();
  await expect(page.locator('.app-confirm-host')).toHaveCount(0);
});

test('Ant Design academic popups remain usable with reduced motion enabled', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await signInAsAdmin(page);
  await page.goto('/admin/academic');

  const academicTabs = page.locator('.admin-academic-tabs .ant-tabs-tab');
  await academicTabs.nth(2).click();

  const courseSelect = page.locator('.ant-tabs-tabpane-active .ant-select').last();
  await courseSelect.click();

  const dropdown = page.locator('.ant-select-dropdown:visible');
  await expect(dropdown).toBeVisible();
  const dropdownBounds = await dropdown.boundingBox();
  expect(dropdownBounds).not.toBeNull();
  expect(dropdownBounds.x).toBeGreaterThanOrEqual(0);
  expect(dropdownBounds.y).toBeGreaterThanOrEqual(0);
  expect(dropdownBounds.x + dropdownBounds.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
  expect(dropdownBounds.y + dropdownBounds.height).toBeLessThanOrEqual(page.viewportSize().height + 1);

  await dropdown.locator('.ant-select-item-option').first().click();
  await expect(page.getByText('Loading...', { exact: true })).toHaveCount(0);
  const classActionButton = page.locator('.ant-tabs-tabpane-active .entity-action-button').first();
  await classActionButton.click();
  await expect(page.locator('.ant-dropdown:visible')).toBeVisible();
});

test('Tutor V2 admin route loads role-gated workflow without viewport overflow', async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto('/admin/expert-training');

  await expect(page).toHaveURL(/\/admin\/v2\?.*tab=coverage/);
  await expect(page.getByRole('heading', { name: 'Giám sát Tutor V2' })).toBeVisible();
  await expect(
    page.getByText('PRO192 · Object-Oriented Programming', { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Phủ kiến thức' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Duyệt/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Đánh giá AI' })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Phân tích độ phủ' })).toBeVisible();

  const pageBounds = await page.locator('.expert-training-page--reviewer').boundingBox();
  const headerBounds = await page.locator('.expert-training-page--reviewer > .page-header').boundingBox();
  const scopeBounds = await page.locator('.expert-training-page--reviewer > .scope-bar').boundingBox();
  const tabsBounds = await page.locator('.expert-training-page--reviewer > .expert-training__tabs').boundingBox();
  const expectedInset = page.viewportSize().width <= 820 ? 0 : 24;

  expect(pageBounds).not.toBeNull();
  expect(headerBounds).not.toBeNull();
  expect(scopeBounds).not.toBeNull();
  expect(tabsBounds).not.toBeNull();
  expect(Math.abs(headerBounds.x - (pageBounds.x + expectedInset))).toBeLessThanOrEqual(1);
  expect(Math.abs(scopeBounds.x - headerBounds.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(tabsBounds.x - headerBounds.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(scopeBounds.width - headerBounds.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(tabsBounds.width - headerBounds.width)).toBeLessThanOrEqual(1);

  await page.getByRole('switch', { name: 'Dùng giao diện tối' }).click();
  await expect(page.locator('.scope-bar')).toHaveCSS('background-color', 'rgb(15, 15, 15)');

  await page.getByRole('tab', { name: /^Duyệt/ }).click();
  await expect(page).toHaveURL(/\/admin\/v2\?.*tab=review/);
  await page.reload();
  await expect(page.getByRole('tab', { name: /^Duyệt/ })).toHaveAttribute('aria-selected', 'true');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('Teacher sees only the task board and Student is denied Tutor V2 routes', async ({ page }) => {
  await signInAsTeacher(page);
  await page.goto('/teacher/expert-training');
  await expect(page).toHaveURL(/\/teacher\/expert-tasks/);
  await expect(page.getByRole('heading', { name: 'Công việc tri thức AI' }).first()).toBeVisible();
  await expect(page.locator('.page-header')).toHaveCSS('border-radius', '18px');
  await expect(page.getByText('Cần làm (0)', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Phủ kiến thức' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Đánh giá AI' })).toHaveCount(0);

  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await signIn(page);
  await page.goto('/senior/v2');
  await expect(page.getByText('Không có quyền truy cập', { exact: true })).toBeVisible();
});

test('Teacher can reopen completed student ChatRoom history while Senior has no class chat', async ({ page }) => {
  await page.route('**/api/tutor/escalations/teachers/teacher-1*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        escalations: [{
          id: 'esc-completed',
          userId: 'student-1',
          studentName: 'E2E Student',
          question: 'Em cần xem lại phần giải thích Servlet và JSP.',
          courseId: 'PRO192',
          classId: 'SE1833',
          status: 'COMPLETED',
          chatRoomId: 'room-completed',
          createdAt: '2026-07-24T08:00:00Z',
        }],
      }),
    });
  });
  await page.route('**/api/tutor/answer-reviews/mentor-pending*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ groups: [], reviews: [] }) });
  });
  await page.route('**/api/chat/history*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [
          { id: 'message-2', senderId: 'teacher-1', senderName: 'E2E Teacher', senderRole: 'MENTOR', content: 'Thầy đã giải thích phần này.', sentAt: '2026-07-24T08:02:00Z' },
          { id: 'message-1', senderId: 'student-1', senderName: 'E2E Student', senderRole: 'USER', content: 'Em chưa hiểu Servlet.', sentAt: '2026-07-24T08:01:00Z' },
        ],
      }),
    });
  });
  await page.route('**/api/chat/detail*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ chatRoomId: 'room-completed', status: 'CLOSED', userName: 'E2E Student' }),
    });
  });
  await page.route('**/api/chat/mark-read', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'SUCCESS' }) });
  });

  await signInAsTeacher(page);
  await page.goto('/teacher/review-queue');
  await expect(page.getByText('Lịch sử (1)', { exact: true })).toBeVisible();
  await expect(page.getByText('Em chưa hiểu Servlet.', { exact: true })).toBeVisible();
  await expect(page.getByText('Thầy đã giải thích phần này.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Gửi tin nhắn hỗ trợ')).toHaveCount(0);

  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await signInAsSenior(page);
  await expect(page.getByRole('heading', { name: 'Trung tâm kiểm duyệt chuyên môn' })).toBeVisible();
  await expect(page.getByText('Trao đổi với sinh viên', { exact: true })).toHaveCount(0);
});
