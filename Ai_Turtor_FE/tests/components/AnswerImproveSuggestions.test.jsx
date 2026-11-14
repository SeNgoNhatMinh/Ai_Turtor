import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AnswerImproveSuggestions from '../../src/features/student/chat/components/AnswerImproveSuggestions';
import {
  getStudySuggestionKey,
  getStudySuggestionStorageKey,
  isSuccessfulStudySuggestionAnswer,
  readLearnedStudySuggestions,
} from '../../src/features/student/learning/studySuggestionProgress';

describe('AnswerImproveSuggestions learning progress', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows the selected lesson with a Đã học label and keeps the next lesson actionable', () => {
    const onStudy = vi.fn();
    const learned = { text: 'Tôi muốn tìm hiểu về Servlet và JSP.' };
    const nextLesson = { text: 'Học tiếp chương MVC.' };

    render(
      <AnswerImproveSuggestions
        suggestions={[nextLesson]}
        currentLearnedSuggestion={learned}
        learnedSuggestionKeys={[getStudySuggestionKey(learned)]}
        onStudy={onStudy}
        heading="Gợi ý học tập"
      />,
    );

    expect(screen.getByLabelText('Tôi muốn tìm hiểu về Servlet và JSP. - Đã học')).toBeVisible();
    expect(screen.getAllByRole('button', { name: /Học ngay/ })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /Học ngay/ }));
    expect(onStudy).toHaveBeenCalledWith(expect.objectContaining({
      text: 'Học tiếp chương MVC.',
    }));
  });

  it('dims the other lesson buttons while one lesson is being answered', () => {
    const onStudy = vi.fn();
    const current = { text: 'Servlet và JSP' };
    const other = { text: 'MVC' };

    render(
      <AnswerImproveSuggestions
        suggestions={[current, other]}
        onStudy={onStudy}
        actionsLocked
        activeSuggestionKey={getStudySuggestionKey(current)}
        heading="Gợi ý học tập"
      />,
    );

    const buttons = screen.getAllByRole('button', { name: /Học ngay/ });
    expect(buttons).toHaveLength(2);
    buttons.forEach((button) => expect(button).toBeDisabled());
    expect(buttons[0].closest('article')).not.toHaveClass('is-dimmed');
    expect(buttons[0].closest('article')).toHaveClass('is-active');
    expect(buttons[1].closest('article')).toHaveClass('is-dimmed');

    fireEvent.click(buttons[1]);
    expect(onStudy).not.toHaveBeenCalled();
  });

  it('reads learned suggestions from storage per student and course', () => {
    const storageKey = getStudySuggestionStorageKey('student-1', 'PRJ301');
    localStorage.setItem(storageKey, JSON.stringify([{
      key: 'text:servlet và jsp',
      text: 'Servlet và JSP',
      learnedAt: '2026-11-12T00:00:00.000Z',
    }]));

    expect(readLearnedStudySuggestions('student-1', 'PRJ301')).toEqual([{
      key: 'text:servlet và jsp',
      text: 'Servlet và JSP',
      learnedAt: '2026-11-12T00:00:00.000Z',
    }]);
    expect(readLearnedStudySuggestions('student-1', 'PRJ302')).toEqual([]);
  });

  it('marks only a real tutor answer as completed learning', () => {
    const baseMessage = {
      studySuggestionKey: 'text:servlet và jsp',
      answer: 'Servlet xử lý request phía máy chủ.',
      mode: 'RAG',
      outcome: 'ANSWERED',
      pending: false,
    };

    expect(isSuccessfulStudySuggestionAnswer(baseMessage)).toBe(true);
    expect(isSuccessfulStudySuggestionAnswer({
      ...baseMessage,
      answer: 'Câu hỏi đã được gửi cho giáo viên/mentor phụ trách.',
      mode: 'ESCALATE',
      outcome: 'NEEDS_MENTOR',
      questionEscalationId: 'escalation-1',
    })).toBe(false);
  });
});
