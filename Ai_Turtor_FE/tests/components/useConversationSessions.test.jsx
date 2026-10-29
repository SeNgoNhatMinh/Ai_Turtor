import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../src/app/queryKeys';
import { useConversationSessions } from '../../src/features/student/chat/useConversationSessions';

vi.mock('../../src/services/conversationApi', () => ({
  conversationApi: {
    getConversations: vi.fn().mockResolvedValue({ conversations: [] }),
    getMessages: vi.fn().mockResolvedValue({ messages: [] }),
    createConversation: vi.fn(),
    deleteConversation: vi.fn(),
    renameConversation: vi.fn(),
  },
}));

const USER_ID = 'student-1';

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useConversationSessions({
    currentUser: { userId: USER_ID },
    studentId: USER_ID,
    courseId: 'CEA201',
    classId: 'CEA201-01',
    triggerToast: vi.fn(),
  }), { wrapper });
  return { queryClient, result };
}

describe('useConversationSessions reply routing', () => {
  it('keeps a pending turn in its own conversation when switching away', () => {
    const { queryClient, result } = setup();
    const keyA = queryKeys.conversationMessages('conv-a', USER_ID);
    const pendingTurn = { question: 'Cấu trúc CPU là gì?', answer: null, pending: true, requestId: 7 };

    act(() => {
      result.current.setActiveSessionId('conv-a');
      queryClient.setQueryData(keyA, [pendingTurn]);
    });
    act(() => {
      result.current.setActiveSessionId('conv-b');
    });

    // The pending turn stays in conv-a and is not dragged into conv-b.
    expect(queryClient.getQueryData(keyA)).toEqual([pendingTurn]);
    expect(queryClient.getQueryData(queryKeys.conversationMessages('conv-b', USER_ID))).toBeUndefined();
    expect(result.current.getActiveSessionId()).toBe('conv-b');
  });

  it('updates conversation activity in place without reordering the list', () => {
    const { queryClient, result } = setup();
    const sessionsKey = queryKeys.conversations(USER_ID, 'CEA201');
    const sessionA = { id: 'conv-a', title: 'A', messageCount: 1, userQuestionCount: 1 };
    const sessionB = { id: 'conv-b', title: 'B', messageCount: 3, userQuestionCount: 2 };

    act(() => {
      queryClient.setQueryData(sessionsKey, [sessionA, sessionB]);
    });
    act(() => {
      result.current.bumpConversationActivity({
        conversationId: 'conv-a',
        title: 'A',
        messageCountIncrement: 1,
        questionCountIncrement: 1,
      });
    });

    const sessions = queryClient.getQueryData(sessionsKey);
    // Order is stable: conv-a stays first instead of jumping around.
    expect(sessions.map((session) => session.id)).toEqual(['conv-a', 'conv-b']);
    expect(sessions[0].messageCount).toBe(2);
  });

  it('writes a finished reply only to the conversation it belongs to', () => {
    const { queryClient, result } = setup();
    const keyA = queryKeys.conversationMessages('conv-a', USER_ID);
    const keyB = queryKeys.conversationMessages('conv-b', USER_ID);

    act(() => {
      result.current.setActiveSessionId('conv-b');
      queryClient.setQueryData(keyA, [{ question: 'Cấu trúc CPU là gì?', answer: null, pending: true, requestId: 7 }]);
      queryClient.setQueryData(keyB, [{ question: 'Câu khác', answer: 'Đã trả lời', pending: false }]);
    });
    act(() => {
      result.current.setMessagesForConversation('conv-a', (list) => list.map((item) => (
        item.requestId === 7 ? { ...item, answer: 'CPU gồm ALU và CU.', pending: false } : item
      )));
    });

    expect(queryClient.getQueryData(keyA)).toEqual([
      { question: 'Cấu trúc CPU là gì?', answer: 'CPU gồm ALU và CU.', pending: false, requestId: 7 },
    ]);
    expect(queryClient.getQueryData(keyB)).toEqual([
      { question: 'Câu khác', answer: 'Đã trả lời', pending: false },
    ]);
  });
});
