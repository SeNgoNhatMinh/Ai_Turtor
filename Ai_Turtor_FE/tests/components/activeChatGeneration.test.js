import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  acknowledgeActiveChatGeneration,
  beginActiveChatGeneration,
  completeActiveChatGeneration,
  getActiveChatGeneration,
  rememberActiveChatConversation,
  subscribeActiveChatGeneration,
} from '../../src/features/student/chat/activeChatGeneration';

describe('active chat generation', () => {
  afterEach(() => {
    const run = getActiveChatGeneration();
    if (!run) return;
    if (run.status === 'running') completeActiveChatGeneration(run.requestId);
    acknowledgeActiveChatGeneration(run.requestId);
  });

  it('keeps a finished lesson answer available after the page that started it is gone', () => {
    const cancel = vi.fn();
    beginActiveChatGeneration({
      requestId: 7,
      userId: 'student-1',
      courseId: 'PRJ301',
      suggestionKey: 'text:servlet',
      cancel,
    });
    rememberActiveChatConversation(7, {
      conversationId: 'conversation-1',
      title: 'Servlet',
    });
    completeActiveChatGeneration(7);

    const finished = getActiveChatGeneration();
    expect(finished).toEqual(expect.objectContaining({
      status: 'done',
      conversationId: 'conversation-1',
      suggestionKey: 'text:servlet',
    }));
    expect(cancel).not.toHaveBeenCalled();

    const seen = [];
    const unsubscribe = subscribeActiveChatGeneration((run) => seen.push(run?.status || 'idle'));
    acknowledgeActiveChatGeneration(7);
    unsubscribe();

    expect(seen).toEqual(['done', 'idle']);
    expect(getActiveChatGeneration()).toBeNull();
  });
});
