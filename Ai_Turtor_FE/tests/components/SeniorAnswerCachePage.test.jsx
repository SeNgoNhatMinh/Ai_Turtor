import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SeniorAnswerCachePage from '../../src/features/senior/answer-cache/SeniorAnswerCachePage';
import { chapterMemoryApi } from '../../src/services/chapterMemoryApi';

vi.mock('../../src/features/answer-cache/hooks/useAnswerCacheScope', () => ({
  useAnswerCacheScope: () => ({
    courseOptions: [{ value: 'PRJ301', label: 'PRJ301 · Java Web' }],
    loadingCourses: false,
    coursesError: '',
    reloadCourses: vi.fn(),
  }),
}));

vi.mock('../../src/services/chapterMemoryApi', () => ({
  chapterMemoryApi: {
    snapshot: vi.fn(),
    reload: vi.fn(),
  },
}));

const snapshot = {
  courseId: 'PRJ301',
  loaded: true,
  chapterCount: 1,
  excerptLimit: 12000,
  characters: 9,
  chapters: [{
    chapterKey: 'servlet',
    title: 'Servlet lifecycle',
    characters: 9,
    materialId: 'material-1',
    text: 'loop body',
  }],
};

describe('senior RAM chapter cache page', () => {
  it('shows the chapters currently held in memory', async () => {
    chapterMemoryApi.snapshot.mockResolvedValue(snapshot);
    render(<SeniorAnswerCachePage courseId="PRJ301" setCourseId={vi.fn()} triggerToast={vi.fn()} />);

    expect(await screen.findByText('PRJ301 đang có 1 chương trong RAM.')).toBeVisible();
    expect(screen.getByText('Servlet lifecycle')).toBeVisible();
    expect(document.body.textContent).toContain('không phải câu trả lời đã viết sẵn');
    expect(screen.queryByText(/semantic similarity/)).not.toBeInTheDocument();
  });

  it('reloads indexed chunks into RAM', async () => {
    chapterMemoryApi.snapshot.mockResolvedValue({ ...snapshot, loaded: false, chapterCount: 0, chapters: [], characters: 0 });
    chapterMemoryApi.reload.mockResolvedValue(snapshot);
    const triggerToast = vi.fn();
    render(<SeniorAnswerCachePage courseId="PRJ301" setCourseId={vi.fn()} triggerToast={triggerToast} />);

    expect(await screen.findByText(/chưa được nạp vào RAM/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Nạp lại từ chunk đã index/ }));

    expect(await screen.findByText('PRJ301 đang có 1 chương trong RAM.')).toBeVisible();
    expect(chapterMemoryApi.reload).toHaveBeenCalledWith('PRJ301');
    expect(triggerToast).toHaveBeenCalledWith('Đã nạp 1 chương vào RAM.', 'success');
  });
});
