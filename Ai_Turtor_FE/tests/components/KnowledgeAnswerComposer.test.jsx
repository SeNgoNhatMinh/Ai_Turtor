import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import KnowledgeAnswerComposer from '../../src/features/teacher/review/KnowledgeAnswerComposer';
import { KNOWLEDGE_ANSWER_MAX_LENGTH } from '../../src/constants/knowledgeAnswer';

vi.mock('../../src/services/knowledgeImagesApi', () => ({
  knowledgeImagesApi: {
    upload: vi.fn(),
    fetchBlob: vi.fn(),
  },
  normalizeKnowledgeImages: (source) => (Array.isArray(source) ? source : []),
}));

describe('KnowledgeAnswerComposer', () => {
  it('allows long academic answers up to 20000 characters', () => {
    const onChange = vi.fn();
    render(
      <KnowledgeAnswerComposer
        id="knowledge-answer"
        label="Câu trả lời học thuật đúng"
        value={'A'.repeat(600)}
        onChange={onChange}
      />,
    );

    const editor = screen.getByRole('textbox', { name: /Câu trả lời học thuật đúng/ });
    expect(editor).toHaveAttribute('maxlength', String(KNOWLEDGE_ANSWER_MAX_LENGTH));
    fireEvent.change(editor, { target: { value: 'A'.repeat(1200) } });
    expect(onChange).toHaveBeenCalledWith('A'.repeat(1200));
  });

  it('does not offer image upload on the teacher answer form', () => {
    render(<KnowledgeAnswerComposer id="knowledge-answer" value="" onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Thêm hình minh họa' })).not.toBeInTheDocument();
    expect(screen.getByText('Tối đa 20.000 ký tự.')).toBeInTheDocument();
  });
});
