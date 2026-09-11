import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MarkdownRenderer from '../../src/components/markdown/MarkdownRenderer';
import MarkdownErrorBoundary from '../../src/components/markdown/MarkdownErrorBoundary';

function BrokenMarkdownChild() {
  throw new Error('forced markdown renderer failure');
}

describe('MarkdownRenderer Vietnamese text', () => {
  it('keeps Markdown formatted with neutral styling when the rich renderer fails', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <MarkdownErrorBoundary
        contentKey="fallback-example"
        fallbackText={'## Giải thích\n\nNội dung **quan trọng**.\n\n1. Bước đầu tiên'}
      >
        <BrokenMarkdownChild />
      </MarkdownErrorBoundary>,
    );

    expect(document.querySelector('.ai-answer-fallback')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Giải thích' })).toBeVisible();
    expect(screen.getByText('quan trọng')).toBeVisible();
    expect(document.querySelector('.ai-answer-render-error')).not.toBeInTheDocument();
    warn.mockRestore();
  });

  it('renders a long lesson explanation as prose instead of the red fallback', () => {
    render(
      <MarkdownRenderer
        markdown={[
          '## Giải thích',
          '',
          'Chapter 1 *Introduction* của tài liệu **Java Virtual Machine Specification** giới thiệu tổng quan về ngôn ngữ Java và máy ảo Java (JVM). Phần 1.1 *A Bit of History* mô tả lịch sử ra đời của Java, mục tiêu hỗ trợ các thiết bị mạng và khả năng chạy trên nhiều kiến trúc phần cứng mà không lo về an toàn.',
          '',
          'Trong tài liệu hiện tại (materialId = 6a7c8c4f65abb40bc742abf4) chỉ có các mục 1.1 và 1.2; không có mục 1.5 **Feedback**.',
          '',
          '1. **Mở tài liệu** tại link `https://docs.oracle.com/javase/specs/jvms/se8/html/jvms-1.html`.',
          '2. **Xác định mục tiêu**: hiểu vì sao Java được thiết kế để “write once, run anywhere”.',
        ].join('\n')}
      />,
    );

    expect(document.querySelector('.ai-answer-render-error')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Giải thích' })).toBeVisible();
  });

  it('renders corrected structural headings and preserves accented body text', () => {
    render(
      <MarkdownRenderer markdown={'## Chan doan van de\n\nConstructor là phương thức đặc biệt để khởi tạo đối tượng.'} />,
    );

    expect(screen.getByRole('heading', { name: 'Chẩn đoán vấn đề' })).toBeInTheDocument();
    expect(screen.getByText('Constructor là phương thức đặc biệt để khởi tạo đối tượng.'))
      .toBeInTheDocument();
  });

  it('repairs mojibake at the shared renderer boundary', () => {
    render(<MarkdownRenderer markdown="Cuá»™c trÃ² chuyá»‡n má»›i" />);
    expect(screen.getByText('Cuộc trò chuyện mới')).toBeInTheDocument();
  });
  it('keeps keyboard shortcuts together as one inline code token', () => {
    render(<MarkdownRenderer markdown={'Mở Settings (hoặc nhấn `Ctrl\nAlt\nS`).'} />);

    const shortcut = screen.getByText('Ctrl Alt S');
    expect(shortcut.tagName).toBe('CODE');
    expect(shortcut).toHaveClass('ai-answer-inline-code--shortcut');
  });

  it('does not split a plus-separated keyboard shortcut into bullet lines', () => {
    render(<MarkdownRenderer markdown={'- Mở **Settings** (`File ➪ Settings` hoặc `Ctrl + Alt + S`).'} />);

    const shortcut = screen.getByText('Ctrl + Alt + S');
    expect(shortcut.tagName).toBe('CODE');
    expect(shortcut).toHaveClass('ai-answer-inline-code--shortcut');
    expect(screen.queryByText('Alt')).not.toBeInTheDocument();
    expect(screen.queryByText('S')).not.toBeInTheDocument();
  });

  it('renders arithmetic expressions as one compact list item', () => {
    render(
      <MarkdownRenderer
        markdown={'- **Tổng số thanh ghi:** (1 + 3) + (3 + 4) = **11** thanh ghi.'}
      />,
    );

    const item = screen.getByRole('listitem');
    expect(item).toHaveTextContent('Tổng số thanh ghi: (1 + 3) + (3 + 4) = 11 thanh ghi.');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('keeps the course-material answer when hideSourceSection is on and the body cites a PDF', () => {
    render(
      <MarkdownRenderer
        hideSourceSection
        markdown={[
          '## Theo tài liệu môn học',
          '',
          'OOP (Object-Oriented Programming) là lập trình hướng đối tượng. Tài liệu PRO192.pdf nêu class, object, inheritance.',
          '',
          '## Lưu ý để học tốt hơn',
          '',
          '- Xem các chương về class, object',
          '',
          '## Nguồn tài liệu đã dùng',
          '',
          '- PRO192.pdf',
        ].join('\n')}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Theo tài liệu môn học' })).toBeInTheDocument();
    expect(
      screen.getByText(/OOP \(Object-Oriented Programming\) là lập trình hướng đối tượng/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Nguồn tài liệu đã dùng' })).not.toBeInTheDocument();
  });

  it('sends the exact selected study tip into the continue-learning flow', () => {
    const onStudyTipStudy = vi.fn();
    render(
      <MarkdownRenderer
        markdown={'## Lưu ý để học tốt hơn\n\n- Ôn lại vòng đời Servlet'}
        onStudyTipStudy={onStudyTipStudy}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ôn lại vòng đời Servlet' }));
    expect(onStudyTipStudy).toHaveBeenCalledWith('Ôn lại vòng đời Servlet');
  });

  it('turns the next-lesson line into a clickable lesson chip', () => {
    const onStudyTipStudy = vi.fn();
    render(
      <MarkdownRenderer
        markdown={'## Bài tiếp theo\n\n- Bài 2 – Sử dụng biến lặp (itervar) trong thân vòng.'}
        onStudyTipStudy={onStudyTipStudy}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Bài 2/ }));
    expect(onStudyTipStudy).toHaveBeenCalledWith('Bài 2 – Sử dụng biến lặp (itervar) trong thân vòng.');
  });

  it('treats same-page study-tip URLs as buttons instead of navigation', () => {
    const onStudyTipStudy = vi.fn();
    render(
      <MarkdownRenderer
        markdown="[Ôn constructor](http://localhost:5173/student/chat#ai-study-tip-1)"
        onStudyTipStudy={onStudyTipStudy}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ôn constructor' }));
    expect(onStudyTipStudy).toHaveBeenCalledWith('Ôn constructor');
  });

  it('keeps study tips as review text when no continue-learning handler is provided', () => {
    render(
      <MarkdownRenderer markdown={'## Bài tiếp theo\n\n- Bài 2 – Sử dụng biến lặp (itervar) trong thân vòng.'} />,
    );

    expect(screen.queryByRole('button', { name: /Bài 2/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Bài 2/)).toBeVisible();
  });
});
