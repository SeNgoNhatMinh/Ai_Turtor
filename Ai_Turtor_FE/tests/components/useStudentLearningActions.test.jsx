import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useStudentLearningActions } from '../../src/features/student/learning/useStudentLearningActions';

describe('useStudentLearningActions', () => {
  it('sends the study tip immediately when already in chat', () => {
    const sendChatMessage = vi.fn();
    const setChatDraft = vi.fn();
    const switchTab = vi.fn();
    const { result } = renderHook(() => useStudentLearningActions({
      sendChatMessage,
      setChatDraft,
      switchTab,
    }));

    act(() => result.current.handleStudySuggestion('Servlet lifecycle'));

    expect(sendChatMessage).toHaveBeenCalledOnce();
    expect(sendChatMessage.mock.calls[0][0]).toContain('Servlet lifecycle');
    expect(setChatDraft).not.toHaveBeenCalled();
    expect(switchTab).not.toHaveBeenCalled();
  });

  it('extracts text from a structured improve suggestion before sending', () => {
    const sendChatMessage = vi.fn();
    const { result } = renderHook(() => useStudentLearningActions({
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

  it('keeps document provenance when a student opens a source-backed study tip', () => {
    const sendChatMessage = vi.fn();
    const { result } = renderHook(() => useStudentLearningActions({ sendChatMessage }));

    act(() => result.current.handleStudySuggestion({
      text: 'Đọc lại ví dụ brontosaurus để thấy lợi ích của get',
      interactionType: 'SOURCE_BACKED_STUDY_TIP',
      sourceMaterialIds: ['pythonlearn'],
      sourceChunkIds: ['pythonlearn-section-9-chunk-2'],
    }));

    expect(sendChatMessage).toHaveBeenCalledWith(
      expect.stringContaining('brontosaurus'),
      expect.objectContaining({
        interactionType: 'SOURCE_BACKED_STUDY_TIP',
        sourceMaterialIds: ['pythonlearn'],
        sourceChunkIds: ['pythonlearn-section-9-chunk-2'],
      }),
    );
  });

  it('marks a roadmap lesson as guided even when an older session has no provenance', () => {
    const sendChatMessage = vi.fn();
    const { result } = renderHook(() => useStudentLearningActions({ sendChatMessage }));

    act(() => result.current.handleStudySuggestion('Bắt đầu bài 2: Sử dụng continue trong vòng lặp while'));

    expect(sendChatMessage).toHaveBeenCalledWith(
      'Bắt đầu bài 2: Sử dụng continue trong vòng lặp while',
      expect.objectContaining({
        interactionType: 'GUIDED_LESSON',
        clickedSuggestion: 'Bắt đầu bài 2: Sử dụng continue trong vòng lặp while',
      }),
    );
  });

  it('passes the exact chapter identity for a grounded guided lesson', () => {
    const sendChatMessage = vi.fn();
    const { result } = renderHook(() => useStudentLearningActions({ sendChatMessage }));

    act(() => result.current.handleStudySuggestion({
      title: 'Bai 2: Dictionary debugging',
      interactionType: 'GUIDED_LESSON',
      chapterKey: 'dictionary-debugging',
      chapterTitle: 'Dictionary debugging',
      sourceMaterialIds: ['python-book'],
    }));

    expect(sendChatMessage).toHaveBeenCalledWith(
      expect.stringContaining('Dictionary debugging'),
      expect.objectContaining({
        interactionType: 'GUIDED_LESSON',
        chapterKey: 'dictionary-debugging',
        chapterTitle: 'Dictionary debugging',
        sourceMaterialIds: ['python-book'],
      }),
    );
  });
});
