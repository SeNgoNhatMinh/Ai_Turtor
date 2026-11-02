import { describe, expect, it } from 'vitest';
import { withCurriculumWelcome } from '../../src/features/student/chat/curriculumWelcomeMessage';

describe('withCurriculumWelcome', () => {
  it('keeps the curriculum visible after the conversation has messages', () => {
    const chatMessages = [{
      id: 'message-1',
      question: 'Tôi muốn tìm hiểu về Servlet và JSP.',
      answer: 'Servlet xử lý request phía máy chủ.',
    }];

    const result = withCurriculumWelcome(chatMessages, {
      courseId: 'PRJ301',
      curriculumWelcome: '# Lộ trình PRJ301\n\nHọc Servlet và JSP',
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(expect.objectContaining({
      id: 'curriculum-PRJ301',
      proactive: true,
      mode: 'RAG',
    }));
    expect(result[1]).toBe(chatMessages[0]);
  });

  it('does not duplicate the synthetic curriculum message', () => {
    const firstResult = withCurriculumWelcome([], {
      courseId: 'PRJ301',
      curriculumWelcome: 'Lộ trình PRJ301',
    });

    const secondResult = withCurriculumWelcome(firstResult, {
      courseId: 'PRJ301',
      curriculumWelcome: 'Lộ trình PRJ301',
    });

    expect(secondResult.filter((message) => message.id === 'curriculum-PRJ301')).toHaveLength(1);
  });

  it('leaves chat messages unchanged while curriculum data is unavailable', () => {
    const chatMessages = [{ id: 'message-1' }];

    expect(withCurriculumWelcome(chatMessages, {
      courseId: 'PRJ301',
      curriculumWelcome: '',
    })).toBe(chatMessages);
    expect(withCurriculumWelcome(chatMessages, {
      courseId: 'PRJ301',
      curriculumWelcome: 'Lộ trình PRJ301',
      isMessagesLoading: true,
    })).toBe(chatMessages);
  });
});
