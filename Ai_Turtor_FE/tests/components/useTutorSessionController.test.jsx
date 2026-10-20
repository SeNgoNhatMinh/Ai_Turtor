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


  it('does not steal focus from a manually created chat while auto-open is pending', async () => {
    let resolveOpen;
    tutorSessionApi.openSession.mockReturnValue(new Promise((resolve) => {
      resolveOpen = resolve;
    }));
    const { result, rerender } = renderHook(
      ({ activeSessionId }) => useTutorSessionController({ ...props, activeSessionId }),
      { initialProps: { activeSessionId: null } },
    );

    let openPromise;
    act(() => {
      openPromise = result.current.openTutorSession();
    });

    rerender({ activeSessionId: 'manual-chat-1' });
    await act(async () => {
      resolveOpen({
        session: {
          id: 'tutor-session-1',
          studentId: 'student-1',
          courseId: 'PRJ301',
          classId: 'SE1840',
          supportLevel: 'STANDARD',
        },
        conversationId: 'auto-chat-1',
      });
      await openPromise;
    });

    expect(props.handleSelectSession).not.toHaveBeenCalledWith(
      'auto-chat-1',
      'Buổi học cùng AI Tutor',
      expect.anything(),
    );
  });

  it('does not navigate to a realtime tutor chat when another chat is active', async () => {
    const { rerender } = renderHook(
      ({ activeSessionId }) => useTutorSessionController({ ...props, activeSessionId }),
      { initialProps: { activeSessionId: 'manual-chat-1' } },
    );
    const openedHandler = [...realtimeHandlers.entries()]
      .find(([types]) => types.includes('TUTOR_SESSION_OPENED'))?.[1];

    act(() => {
      openedHandler({
        type: 'TUTOR_SESSION_OPENED',
        data: {
          session: { id: 'tutor-session-1', studentId: 'student-1', courseId: 'PRJ301', classId: 'SE1840' },
          conversationId: 'auto-chat-1',
          openingMessage: { id: 'opening-1', content: 'Welcome' },
        },
      });
    });

    expect(props.handleSelectSession).not.toHaveBeenCalledWith(
      'auto-chat-1',
      'Buổi học cùng AI Tutor',
      expect.anything(),
    );
    rerender({ activeSessionId: 'manual-chat-1' });
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
