import { describe, expect, it } from 'vitest';
import {
  hasStartedStudySuggestion,
  withCurriculumWelcome,
} from '../../src/features/student/chat/curriculumWelcomeMessage';

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

  it('removes the curriculum welcome after a study suggestion is selected', () => {
    const chatMessages = [{
      id: 'message-1',
      question: 'Tôi muốn tìm hiểu về Servlet và JSP.',
      answer: 'Servlet xử lý request phía máy chủ.',
    }];

    const result = withCurriculumWelcome(chatMessages, {
      courseId: 'PRJ301',
      curriculumWelcome: '# Lộ trình PRJ301',
      hasStartedLearning: true,
    });

    expect(result).toEqual(chatMessages);
    expect(result.some((message) => message.proactive)).toBe(false);
  });

  it('treats a newly opened empty chat as not started even when another chat studied before', () => {
    const learnedSuggestions = [{ text: 'Tôi muốn học Servlet' }];

    expect(hasStartedStudySuggestion([], learnedSuggestions)).toBe(false);
    expect(hasStartedStudySuggestion([{
      question: 'Tôi muốn học Servlet',
      studySuggestionKey: 'text:tôi muốn học servlet',
      pending: true,
    }])).toBe(true);
  });

  it('recognizes a learned suggestion after canonical chat history is reloaded', () => {
    expect(hasStartedStudySuggestion([{
      question: 'Tôi muốn học Servlet',
      answer: 'Servlet xử lý request phía máy chủ.',
    }], [{ text: 'Tôi muốn học Servlet' }])).toBe(true);
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
