import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AiAnswer from '../../src/components/AiAnswer';
import AnswerEvidence from '../../src/features/student/chat/components/AnswerEvidence';
import { getCanonicalMessageSources } from '../../src/features/student/chat/chatMessageUtils';
import { buildMaterialSourceMap } from '../../src/utils/sourceLabels';

describe('AnswerEvidence', () => {
  it('renders one canonical material name and keeps its download id', () => {
    const onDownloadSource = vi.fn();
    const materialId = '6a3d56a6ad3e666fbe4566ee';
    const sourceMap = buildMaterialSourceMap([{
      materialId,
      fileName: 'Professional_Java.pdf.pdf.pdf',
    }]);

    render(
      <AnswerEvidence
        message={{
          mode: 'RAG',
          sources: [
            'Professional_Java.pdf.pdf',
            { materialId, fileName: 'Professional_Java.pdf.pdf.pdf' },
            '**Professional\\_Java.pdf**',
          ],
        }}
        sourceMap={sourceMap}
        onDownloadSource={onDownloadSource}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /xem nguồn tài liệu/i }));
    const source = screen.getByText('Professional_Java.pdf');
    expect(source).toBeVisible();
    expect(screen.getAllByText('Professional_Java.pdf')).toHaveLength(1);

    fireEvent.click(source);
    expect(onDownloadSource).toHaveBeenCalledWith(materialId, 'Professional_Java.pdf');
  });

  it('renders the source only once across persisted Markdown and evidence metadata', () => {
    const sourceMap = buildMaterialSourceMap([{
      materialId: '6a3d56a6ad3e666fbe4566ee',
      fileName: 'Professional_Java.pdf',
    }]);
    const message = {
      mode: 'RAG',
      answer: [
        'Nội dung trả lời.',
        '**Nguồn tài liệu đã dùng**',
        '**Professional\\_Java.pdf**',
        '**Professional\\_Java.pdf**',
      ].join('\n\n'),
      sources: ['Professional_Java.pdf'],
    };
    const evidenceMessage = {
      ...message,
      sources: getCanonicalMessageSources(message, sourceMap),
    };

    render(
      <>
        <AiAnswer markdown={message.answer} hideSourceSection />
        <AnswerEvidence message={evidenceMessage} sourceMap={sourceMap} />
      </>,
    );

    expect(screen.getByText('Nội dung trả lời.')).toBeVisible();
    expect(screen.queryByText('Nguồn tài liệu đã dùng')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /xem nguồn tài liệu/i }));
    expect(screen.getAllByText('Professional_Java.pdf')).toHaveLength(1);
  });

  it('shows the evidence count and chapter location before expanding details', () => {
    render(
      <AnswerEvidence
        message={{
          mode: 'RAG',
          groundingType: 'COURSE_MATERIAL',
          sourceEvidence: [{
            courseId: 'PRJ301',
            materialTitle: 'Java Core',
            chapter: 'Choosing a Web Container',
            pageStart: 55,
            excerpt: 'Starting an Application and Hitting Breakpoints',
          }],
        }}
      />,
    );

    expect(screen.getByRole('button', { name: /bằng chứng tài liệu \(1\)/i })).toBeVisible();
    expect(screen.getByText('Java Core · Choosing a Web Container · Trang 55')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /bằng chứng tài liệu \(1\)/i }));
    expect(screen.getByText('Bằng chứng 1')).toBeVisible();
    expect(screen.getByText('Starting an Application and Hitting Breakpoints')).toBeVisible();
  });
});
