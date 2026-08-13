import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StudySuggestionsSection from '../../src/features/student/learning/StudySuggestionsSection';

describe('StudySuggestionsSection', () => {
  it('formats suggestion descriptions and next steps as readable content', () => {
    render(
      <StudySuggestionsSection
        suggestions={[{
          title: 'Improvement Plan: Servlet lifecycle',
          content: 'Cần củng cố thứ tự xử lý.\n\nSuggested steps:\n• Ôn init và destroy\n• Làm quiz ngắn',
          priority: 'high',
        }]}
        pinnedSet={new Set()}
        hasContext
        isSuggesting={false}
        onAnalyze={vi.fn()}
        onStudy={vi.fn()}
        onCreateQuiz={vi.fn()}
        onPin={vi.fn()}
        onUnpin={vi.fn()}
      />,
    );

    expect(screen.getByText('Nội dung nên học tiếp')).toBeVisible();
    expect(screen.getByText('Kế hoạch cải thiện: Servlet lifecycle')).toBeVisible();
    expect(screen.getByText('Cần củng cố thứ tự xử lý.')).toBeVisible();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Ôn init và destroy')).toBeVisible();
  });

  it('collapses long suggestions and shows the complete content in a modal', () => {
    const onStudy = vi.fn();
    const onCreateQuiz = vi.fn();
    const longSummary = 'Memory của môn học ghi nhận bạn đang yếu: AI Learning Improvement Plan, Code debugging, Tóm tắt các câu hỏi gần đây, jsp. Bạn nên chia nhỏ nội dung để ôn tập hiệu quả hơn.';

    render(
      <StudySuggestionsSection
        suggestions={[{
          title: 'Ôn lại chủ đề còn yếu',
          content: `${longSummary}\nCác bước nên làm\nÔn AI Learning Improvement Plan\nÔn Code debugging\nTóm tắt các câu hỏi gần đây\nLàm bài thực hành JSP`,
        }]}
        pinnedSet={new Set()}
        hasContext
        isSuggesting={false}
        onAnalyze={vi.fn()}
        onStudy={onStudy}
        onCreateQuiz={onCreateQuiz}
        onPin={vi.fn()}
        onUnpin={vi.fn()}
      />,
    );

    expect(screen.getByText('+1 bước khác')).toBeVisible();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Xem đầy đủ' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(longSummary)).toBeInTheDocument();
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(4);

    fireEvent.click(within(dialog).getByRole('button', { name: /học ngay/i }));
    expect(onStudy).toHaveBeenCalledWith('Ôn lại chủ đề còn yếu');
  });

  it('renders AI notes separately without learning actions', () => {
    render(
      <StudySuggestionsSection
        suggestions={[{
          kind: 'note',
          title: 'Lưu ý từ AI Tutor',
          content: 'Câu hỏi này nằm ngoài phạm vi tài liệu môn học.',
        }]}
        pinnedSet={new Set()}
        hasContext
        isSuggesting={false}
        onAnalyze={vi.fn()}
        onStudy={vi.fn()}
        onCreateQuiz={vi.fn()}
        onPin={vi.fn()}
        onUnpin={vi.fn()}
      />,
    );

    expect(screen.getByText('Lưu ý từ AI Tutor')).toBeVisible();
    expect(screen.getByText('Câu hỏi này nằm ngoài phạm vi tài liệu môn học.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Học ngay' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tạo quiz' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ghim' })).not.toBeInTheDocument();
  });
});
