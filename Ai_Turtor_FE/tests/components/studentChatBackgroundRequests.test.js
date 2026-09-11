import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/apiClient', () => ({
  API_BASE_URL: '/api',
  API_TIMEOUTS: { ai: 180000 },
  request: vi.fn(),
}));

import { aiTutorApi } from '../../src/services/aiTutorApi';
import { request } from '../../src/services/apiClient';
import { studentLearningApi } from '../../src/services/studentLearningApi';
import { supportChatApi } from '../../src/services/supportChatApi';
import { tutorSessionApi } from '../../src/services/tutorSessionApi';

describe('student chat background requests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    request.mockResolvedValue({});
  });

  it('keeps the login session when optional chat startup requests fail', async () => {
    const preserveSession = { skipUnauthorizedRedirect: true };

    await aiTutorApi.getQuestionQuota('student-1', 'PRO192', preserveSession);
    await tutorSessionApi.openSession({
      studentId: 'student-1',
      courseId: 'PRO192',
      classId: 'SE1833',
    }, preserveSession);
    await supportChatApi.getEscalationHistory('student-1', preserveSession);
    await studentLearningApi.getStudentDashboard('student-1', 'PRO192', preserveSession);
    await studentLearningApi.getStudentMemory('student-1', 'PRO192', preserveSession);

    expect(request).toHaveBeenCalledTimes(5);
    request.mock.calls.forEach(([, options]) => {
      expect(options).toEqual(expect.objectContaining({ skipUnauthorizedRedirect: true }));
    });
  });
});
