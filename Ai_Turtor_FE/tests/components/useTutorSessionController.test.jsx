import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTutorSessionController } from '../../src/features/student/chat/useTutorSessionController';
import { tutorSessionApi } from '../../src/services/tutorSessionApi';

const realtimeHandlers = new Map();

vi.mock('../../src/features/realtime/realtimeContext', () => ({
  useRealtimeEvent: vi.fn((types, handler) => {
    realtimeHandlers.set(Array.isArray(types) ? types.join('|') : types, handler);
  }),
  useRealtimeReconnect: vi.fn(),
  useCanonicalPolling: vi.fn(),
}));

vi.mock('../../src/services/tutorSessionApi', () => ({
  tutorSessionApi: {
    openSession: vi.fn(),
    closeSession: vi.fn(),
    getStudentSupportProfile: vi.fn(),
  },
}));

const props = {
  userId: 'student-1',
  courseId: 'PRJ301',
  classId: 'SE1840',
  activeSessionId: 'conversation-1',
  triggerToast: vi.fn(),
  setMessages: vi.fn(),
  loadChatSessions: vi.fn().mockResolvedValue([]),
  bumpConversationActivity: vi.fn(),
  handleSelectSession: vi.fn().mockResolvedValue(undefined),
};

describe('useTutorSessionController realtime support level', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    realtimeHandlers.clear();
    tutorSessionApi.openSession.mockResolvedValue({
      session: {
        id: 'tutor-session-1',
        studentId: 'student-1',
        courseId: 'PRJ301',
        classId: 'SE1840',
        supportLevel: 'STANDARD',
      },
      conversationId: 'conversation-1',
    });
    tutorSessionApi.getStudentSupportProfile.mockResolvedValue({
      supportLevel: 'STANDARD',
      teacherControlled: true,
      hasActiveTeacherDirective: false,
    });
  });

  it('refetches the canonical support profile after a matching directive event', async () => {
    const { result } = renderHook(() => useTutorSessionController(props));
    await act(async () => {
      await result.current.openTutorSession();
    });
    expect(result.current.activeTutorSession.supportLevel).toBe('STANDARD');

    tutorSessionApi.getStudentSupportProfile.mockResolvedValue({
      supportLevel: 'HIGH_SUPPORT',
      teacherControlled: true,
      hasActiveTeacherDirective: true,
    });
    const directiveHandler = [...realtimeHandlers.entries()]
      .find(([types]) => types.includes('PEDAGOGICAL_DIRECTIVE_CONFIRMED'))?.[1];

    act(() => {
      directiveHandler({
        type: 'PEDAGOGICAL_DIRECTIVE_CONFIRMED',
        data: {
          directive: {
            studentId: 'student-1',
            courseId: 'PRJ301',
            classId: 'SE1840',
          },
        },
      });
    });

    await waitFor(() => {
      expect(result.current.activeTutorSession.supportLevel).toBe('HIGH_SUPPORT');
    });
    expect(tutorSessionApi.getStudentSupportProfile).toHaveBeenLastCalledWith(
      'student-1',
      'PRJ301',
      'SE1840',
      { skipUnauthorizedRedirect: true },
    );
  });

  it('ignores a directive intended for another student', async () => {
    const { result } = renderHook(() => useTutorSessionController(props));
    await act(async () => {
      await result.current.openTutorSession();
    });
    tutorSessionApi.getStudentSupportProfile.mockClear();
    const directiveHandler = [...realtimeHandlers.entries()]
      .find(([types]) => types.includes('PEDAGOGICAL_DIRECTIVE_CONFIRMED'))?.[1];

    act(() => {
      directiveHandler({
        type: 'PEDAGOGICAL_DIRECTIVE_CONFIRMED',
        data: { directive: { studentId: 'student-2', courseId: 'PRJ301', classId: 'SE1840' } },
      });
    });

    expect(tutorSessionApi.getStudentSupportProfile).not.toHaveBeenCalled();
    expect(result.current.activeTutorSession.supportLevel).toBe('STANDARD');
  });
});
