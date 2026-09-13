import { expect, test } from '@playwright/test';

const question = 'Servlet xử lý yêu cầu HTTP như thế nào?';
const newQuestion = 'Phân biệt forward và redirect trong Servlet?';
const teacherAnswer = 'Servlet nhận yêu cầu HTTP và tạo phản hồi thông qua phương thức service().';
const ticket = {
  id: 'ticket-servlet',
  originalQuestion: question,
  conversationId: 'conversation-support',
  courseId: 'PRO192',
  classId: 'SE1833',
  status: 'RESOLVED_INDEXED',
  studentVisibleStatus: 'AI_BRAIN_UPDATED',
  mentorAnswer: teacherAnswer,
  createdAt: '2026-09-11T09:00:00Z',
};
const newerTicket = {
  ...ticket,
  id: 'ticket-newer',
  originalQuestion: 'Một câu hỏi khác trong lịch sử',
  mentorAnswer: 'Phản hồi cho câu hỏi khác.',
  createdAt: '2026-09-12T09:00:00Z',
};

async function setupStudent(page) {
  const unexpectedRequests = [];
  const createdRequests = [];
  let createdTicket;
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const contracts = {
      'POST /api/users/login': {
        id: 'student-1', userId: 'student-1', fullName: 'Sinh viên kiểm thử',
        email: 'student@example.com', role: 'STUDENT', token: 'test-token',
      },
      'GET /api/students/student-1/enrollments': { enrollments: [{
        id: 'enrollment-1', studentId: 'student-1', courseId: 'PRO192',
        courseName: 'Lập trình hướng đối tượng', classId: 'SE1833', className: 'SE1833', status: 'ACTIVE',
      }] },
      'GET /api/courses': { courses: [{ courseId: 'PRO192', courseName: 'Lập trình hướng đối tượng' }] },
      'GET /api/students/student-1/dashboard': { studentId: 'student-1', courseId: 'PRO192' },
      'GET /api/tutor/students/student-1/courses/PRO192/memory': {},
      'GET /api/tutor/students/student-1/courses/PRO192/question-quota': { used: 2, remaining: 8, limit: 10 },
      'GET /api/tutor/students/student-1/courses/PRO192/quizzes': { quizzes: [] },
      'GET /api/tutor/students/student-1/courses/PRO192/quiz-assignments': { assignments: [] },
      'GET /api/students/student-1/improve-plans': { content: [] },
      'GET /api/students/student-1/courses/PRO192/improve-plan': {},
      'GET /api/courses/PRO192/materials': { materials: [] },
      'GET /api/students/student-1/courses/PRO192/classes/SE1833/materials': { materials: [] },
      'GET /api/tts/voices': [],
      'GET /api/ai/conversations': { conversations: [{
        conversationId: 'conversation-support', title: 'Ôn tập Servlet', courseId: 'PRO192', classId: 'SE1833',
        messageCount: 4, userQuestionCount: 2, lastMessageAt: '2026-09-13T09:00:00Z',
      }] },
      'GET /api/ai/conversations/conversation-support/messages': { messages: [
        { id: 'question-1', role: 'USER', content: question },
        { id: 'answer-1', role: 'ASSISTANT', content: 'Servlet tiếp nhận và xử lý các yêu cầu từ trình duyệt.', mode: 'RAG' },
        { id: 'question-2', role: 'USER', content: newQuestion },
        { id: 'answer-2', role: 'ASSISTANT', content: 'Forward chuyển tiếp yêu cầu trên máy chủ, redirect chuyển hướng trình duyệt.', mode: 'RAG' },
      ] },
      'GET /api/ai/conversations/conversation-support/pinned-messages': { messages: [] },
      'POST /api/tutor/sessions/open': { conversationId: 'conversation-support' },
      'GET /api/tutor/escalations/history': { escalations: [newerTicket, ticket, ...(createdTicket ? [createdTicket] : [])] },
      'GET /api/tutor/escalations/ticket-servlet': { questionEscalation: ticket, latestMentorAnswer: { answer: teacherAnswer } },
      'GET /api/tutor/escalations/ticket-newer': { questionEscalation: newerTicket },
      'GET /api/tutor/escalations/ticket-created': { questionEscalation: createdTicket },
    };
    if (request.method() === 'POST' && path === '/api/tutor/escalations') {
      createdRequests.push(request.postDataJSON());
      createdTicket = {
        ...request.postDataJSON(), id: 'ticket-created', originalQuestion: newQuestion,
        status: 'PENDING_OFFER', createdAt: '2026-09-13T09:00:00Z',
      };
      await route.fulfill({ json: createdTicket });
      return;
    }
    const key = `${request.method()} ${path}`;
    if (Object.hasOwn(contracts, key)) {
      await route.fulfill({ json: contracts[key] });
      return;
    }
    unexpectedRequests.push(key);
    await route.fulfill({ status: 501, json: { message: `Unhandled: ${key}` } });
  });
  await page.goto('/login');
  await page.getByLabel('Email').fill('student@example.com');
  await page.getByLabel('Mật khẩu').fill('secret1');
  await page.locator('.login-submit').click();
  await expect(page).toHaveURL(/\/student\/dashboard$/);
  await page.goto('/student/chat');
  await expect(page.getByText(newQuestion, { exact: true })).toBeVisible();
  return { unexpectedRequests, createdRequests };
}

test('student opens the matching support ticket from chat and can return to chat', async ({ page }, testInfo) => {
  const { unexpectedRequests } = await setupStudent(page);
  const supportCard = page.getByRole('region', { name: 'Hỗ trợ từ giảng viên cho câu hỏi này' });
  await supportCard.getByRole('button', { name: 'Xem hỗ trợ', exact: true }).click();
  await expect(supportCard.getByText(teacherAnswer)).toBeVisible();
  await supportCard.screenshot({ path: testInfo.outputPath('support-card.png') });
  await page.getByRole('switch', { name: 'Dùng giao diện tối' }).click();
  await supportCard.screenshot({ path: testInfo.outputPath('support-card-dark.png') });
  await page.getByRole('switch', { name: 'Dùng giao diện sáng' }).click();
  await supportCard.getByRole('button', { name: 'Mở ticket' }).click();
  await expect(page).toHaveURL(/\/student\/mentor-review\?ticket=ticket-servlet$/);
  await expect(page.getByRole('heading', { name: question, exact: true })).toBeVisible();
  await expect(page.getByText(teacherAnswer, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: question, exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('support-detail.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.goBack();
  await expect(page).toHaveURL(/\/student\/chat$/);
  await expect(page.getByText(newQuestion, { exact: true })).toBeVisible();
  expect(unexpectedRequests).toEqual([]);
});

test('student creates support from an AI answer and opens the new ticket', async ({ page }, testInfo) => {
  const { unexpectedRequests, createdRequests } = await setupStudent(page);
  const turn = page.locator('.chat-message-turn').filter({ hasText: newQuestion });
  await turn.getByRole('button', { name: 'Gửi mentor xem xét' }).click();
  const supportCard = turn.getByRole('region', { name: 'Hỗ trợ từ giảng viên cho câu hỏi này' });
  await expect(supportCard.getByText(newQuestion, { exact: true })).toBeVisible();
  await supportCard.screenshot({ path: testInfo.outputPath('support-create.png') });
  await supportCard.getByRole('button', { name: 'Gửi yêu cầu hỗ trợ', exact: true }).click();
  await expect(supportCard.getByRole('button', { name: 'Mở ticket' })).toBeVisible();
  await expect(supportCard.getByRole('button', { name: 'Tìm giáo viên' })).toBeVisible();
  await supportCard.getByRole('button', { name: 'Thu gọn hỗ trợ từ giảng viên' }).click();
  await supportCard.getByRole('button', { name: 'Mở ticket' }).click();
  await expect(page).toHaveURL(/\/student\/mentor-review\?ticket=ticket-created$/);
  await expect(page.getByRole('heading', { name: newQuestion, exact: true })).toBeVisible();
  expect(createdRequests).toHaveLength(1);
  expect(createdRequests[0]).toMatchObject({
    studentId: 'student-1', courseId: 'PRO192', classId: 'SE1833',
    conversationId: 'conversation-support', question: newQuestion,
  });
  expect(unexpectedRequests).toEqual([]);
});
