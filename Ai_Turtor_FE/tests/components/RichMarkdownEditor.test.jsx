import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RichMarkdownEditor from '../../src/features/admin/academic/components/RichMarkdownEditor';

function Harness({ initial = '' }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <RichMarkdownEditor ariaLabel="Nội dung" value={value} onChange={setValue} placeholder="Nhập nội dung" />
      <output aria-label="kết quả">{value}</output>
    </>
  );
}

describe('RichMarkdownEditor', () => {
  it('wraps the selected text in bold markers from the toolbar', () => {
    render(<Harness initial="Học Java cơ bản" />);
    const area = screen.getByLabelText('Nội dung');
    area.focus();
    area.setSelectionRange(4, 8);

    fireEvent.click(screen.getByRole('button', { name: /Đậm/ }));

    expect(screen.getByLabelText('kết quả').textContent).toBe('Học **Java** cơ bản');
  });

  it('prefixes lines as a bullet list', () => {
    render(<Harness initial={'Dòng một\nDòng hai'} />);
    const area = screen.getByLabelText('Nội dung');
    area.focus();
    area.setSelectionRange(0, 17);

    fireEvent.click(screen.getByRole('button', { name: /Danh sách dấu chấm/ }));

    expect(screen.getByLabelText('kết quả').textContent).toBe('- Dòng một\n- Dòng hai');
  });

  it('inserts a link around the selected text using the prompted URL', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('https://example.com/tai-lieu');
    render(<Harness initial="Xem tài liệu môn học" />);
    const area = screen.getByLabelText('Nội dung');
    area.focus();
    area.setSelectionRange(4, 12);

    fireEvent.click(screen.getByRole('button', { name: /Chèn liên kết/ }));

    expect(screen.getByLabelText('kết quả').textContent)
      .toBe('Xem [tài liệu](https://example.com/tai-lieu) môn học');
    window.prompt.mockRestore();
  });

  it('undoes a toolbar formatting change', () => {
    render(<Harness initial="Văn bản gốc" />);
    const area = screen.getByLabelText('Nội dung');
    area.focus();
    area.setSelectionRange(0, 3);

    fireEvent.click(screen.getByRole('button', { name: /Đậm/ }));
    expect(screen.getByLabelText('kết quả').textContent).toBe('**Văn** bản gốc');

    fireEvent.click(screen.getByRole('button', { name: /Hoàn tác/ }));
    expect(screen.getByLabelText('kết quả').textContent).toBe('Văn bản gốc');
  });
});
