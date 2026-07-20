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
});
