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

  it('sends the study tip immediately when already in chat', () => {
    const sendChatMessage = vi.fn();
    const setChatDraft = vi.fn();
    const switchTab = vi.fn();
    const { result } = renderHook(() => useStudentLearningActions({
      activeTab: 'student-chat',
      courseId: 'PRJ301',
      sendChatMessage,
      setChatDraft,
      switchTab,
    }));

    act(() => result.current.handleStudySuggestion('Servlet lifecycle'));

    expect(sendChatMessage).toHaveBeenCalledOnce();
    expect(sendChatMessage.mock.calls[0][0]).toContain('Servlet lifecycle');
    expect(setChatDraft).not.toHaveBeenCalled();
    expect(switchTab).not.toHaveBeenCalled();
    expect(readStudyChatHandoff()).toBeNull();
  });

  it('extracts text from a structured improve suggestion before sending', () => {
    const sendChatMessage = vi.fn();
    const { result } = renderHook(() => useStudentLearningActions({
      activeTab: 'student-chat',
      courseId: 'PRJ301',
      sendChatMessage,
    }));

    act(() => result.current.handleStudySuggestion({
      title: 'Ôn lại class và object',
      sourceMode: 'RAG',
    }));

    expect(sendChatMessage).toHaveBeenCalledOnce();
    expect(sendChatMessage.mock.calls[0][0]).toContain('Ôn lại class và object');
    expect(sendChatMessage.mock.calls[0][0]).not.toContain('[object Object]');
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
