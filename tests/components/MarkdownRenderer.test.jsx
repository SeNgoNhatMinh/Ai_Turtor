import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MarkdownRenderer from '../../src/components/markdown/MarkdownRenderer';

describe('MarkdownRenderer Vietnamese text', () => {
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
});
