import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConversationSessions } from '../../src/features/student/chat/useConversationSessions';
import { conversationApi } from '../../src/services/conversationApi';

vi.mock('../../src/services/conversationApi', () => ({
  conversationApi: {
    createConversation: vi.fn(),
    deleteConversation: vi.fn(),
    renameConversation: vi.fn(),
    getConversations: vi.fn(),
    getMessages: vi.fn(),
  },
}));

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

describe('useConversationSessions mutations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('locks duplicate New Chat requests until the canonical API settles', async () => {
    const request = deferred();
    conversationApi.createConversation.mockReturnValue(request.promise);
    const triggerToast = vi.fn();
    const { result } = renderHook(() => useConversationSessions({
      currentUser: { id: 'student-1' },
      studentId: 'student-1',
      courseId: 'PRO192',
      classId: 'SE1833',
      triggerToast,
    }));

    let first;
    let second;
    await act(async () => {
      first = result.current.handleCreateSession();
      second = result.current.handleCreateSession();
      request.resolve({ id: 'conversation-1', title: 'New OOP chat' });
      await Promise.all([first, second]);
    });

    expect(conversationApi.createConversation).toHaveBeenCalledTimes(1);
    expect(result.current.activeSessionId).toBe('conversation-1');
    expect(result.current.isCreatingSession).toBe(false);
    expect(triggerToast).toHaveBeenCalledWith('Đã tạo cuộc trò chuyện mới.');
  });

  it('returns failure and keeps canonical session state when rename fails', async () => {
    conversationApi.renameConversation.mockRejectedValue(new Error('n8n request failed'));
    const triggerToast = vi.fn();
    const { result } = renderHook(() => useConversationSessions({
      currentUser: { id: 'student-1' },
      studentId: 'student-1',
      courseId: 'PRO192',
      classId: 'SE1833',
      triggerToast,
    }));

    let succeeded;
    await act(async () => {
      succeeded = await result.current.handleRenameSession('conversation-1', 'Renamed');
    });

    expect(succeeded).toBe(false);
    expect(result.current.sessions).toEqual([]);
    expect(triggerToast).toHaveBeenCalledWith(expect.stringContaining('Không thể đổi tên'));
  });

  it('does not turn a silent background history failure into a global logout', async () => {
    conversationApi.getMessages.mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }));
    const triggerToast = vi.fn();
    const { result } = renderHook(() => useConversationSessions({
      currentUser: { id: 'student-1' },
      studentId: 'student-1',
      courseId: 'PRO192',
      classId: 'SE1833',
      triggerToast,
    }));

    await act(async () => {
      await result.current.handleSelectSession('conversation-1', 'Buổi học cùng AI Tutor', { silent: true });
    });

    expect(conversationApi.getMessages).toHaveBeenCalledWith(
      'conversation-1',
      'student-1',
      expect.objectContaining({ skipUnauthorizedRedirect: true }),
    );
    expect(triggerToast).not.toHaveBeenCalled();
  });
});
