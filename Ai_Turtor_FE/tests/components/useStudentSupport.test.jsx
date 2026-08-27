import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/supportChatApi', () => ({
  supportChatApi: {
    getEscalationHistory: vi.fn(),
    getEscalationDetail: vi.fn(),
  },
}));

import { supportChatApi } from '../../src/services/supportChatApi';
import { useStudentSupport } from '../../src/hooks/useStudentSupport';

describe('useStudentSupport navigation stability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supportChatApi.getEscalationHistory.mockResolvedValue([{
      id: 'ticket-1',
      status: 'RESOLVED_INDEXED',
      conversationId: 'conversation-1',
      question: 'Câu hỏi đã được trả lời',
    }]);
    supportChatApi.getEscalationDetail.mockResolvedValue({
      id: 'ticket-1',
      status: 'RESOLVED_INDEXED',
      conversationId: 'conversation-1',
      mentorAnswer: 'Câu trả lời của giảng viên',
    });
  });

  it('keeps a resolved ticket visible instead of redirecting away from the page', async () => {
    const onConversationResolved = vi.fn();
    const { result } = renderHook(() => useStudentSupport({
      activeTab: 'student-escalation',
      userId: 'student-1',
      onConversationResolved,
    }));

    await waitFor(() => expect(result.current.selectedEscalation?.id).toBe('ticket-1'));
    await waitFor(() => expect(result.current.selectedEscalation?.mentorAnswer).toBe(
      'Câu trả lời của giảng viên',
    ));

    expect(onConversationResolved).not.toHaveBeenCalled();
    expect(result.current.selectedEscalation.status).toBe('RESOLVED_INDEXED');

  });
});
