import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStudentLearningActions } from '../../src/features/student/learning/useStudentLearningActions';
import {
  clearStudyChatHandoff,
  readStudyChatHandoff,
} from '../../src/features/student/studentRouteHandoff';

describe('useStudentLearningActions', () => {
  beforeEach(() => {
    clearStudyChatHandoff();
  });

  it('fills an editable chat draft without submitting the suggestion', () => {
    const setChatDraft = vi.fn();
    const switchTab = vi.fn();
    const { result } = renderHook(() => useStudentLearningActions({
      activeTab: 'student-chat',
      courseId: 'PRJ301',
      setChatDraft,
      switchTab,
    }));

    act(() => result.current.handleStudySuggestion('Servlet lifecycle'));

    expect(setChatDraft).toHaveBeenCalledOnce();
    expect(setChatDraft.mock.calls[0][0]).toContain('Servlet lifecycle');
    expect(switchTab).not.toHaveBeenCalled();
    expect(readStudyChatHandoff()).toBeNull();
  });

  it('moves an editable draft from Learning Progress to Chat', () => {
    const switchTab = vi.fn();
    const { result } = renderHook(() => useStudentLearningActions({
      activeTab: 'student-memory',
      courseId: 'PRJ301',
      switchTab,
    }));

    act(() => result.current.handleStudySuggestion('Dependency Injection'));

    expect(switchTab).toHaveBeenCalledWith('student-chat');
    expect(readStudyChatHandoff()).toMatchObject({
      suggestionText: 'Dependency Injection',
    });
    expect(readStudyChatHandoff().prompt).toContain('Dependency Injection');
  });
});
