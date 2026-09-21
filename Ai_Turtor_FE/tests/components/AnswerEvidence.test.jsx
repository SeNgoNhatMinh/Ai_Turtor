import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AiAnswer from '../../src/components/AiAnswer';
import AnswerEvidence from '../../src/features/student/chat/components/AnswerEvidence';
import { getCanonicalMessageSources } from '../../src/features/student/chat/chatMessageUtils';
import { buildMaterialSourceMap } from '../../src/utils/sourceLabels';

describe('AnswerEvidence', () => {
  it('renders one canonical material name without making it downloadable', () => {
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
    expect(source.tagName).toBe('SPAN');
    expect(onDownloadSource).not.toHaveBeenCalled();
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

  it('does not present an escalation-only error as course material evidence', () => {
    render(
      <AnswerEvidence
        message={{
          mode: 'RAG',
          groundingType: 'NONE',
          confidence: 0,
          sources: [],
          sourceEvidence: [],
          questionEscalationId: 'escalation-1',
        }}
      />,
    );

    expect(screen.getByText('Đã gửi yêu cầu mentor xem xét')).toBeVisible();
    expect(screen.queryByRole('button', { name: /bằng chứng|nguồn tài liệu/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/mức độ phù hợp với tài liệu/i)).not.toBeInTheDocument();
  });

  it('labels confidence as retrieval-source matching rather than answer confidence', () => {
    render(
      <AnswerEvidence
        message={{
          mode: 'RAG',
          groundingType: 'COURSE_MATERIAL',
          confidence: 0.72,
          sources: ['material-1'],
          sourceEvidence: [],
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /xem nguồn tài liệu/i }));
    expect(screen.getByText('Độ khớp của nguồn với câu hỏi: 72%')).toBeVisible();
  });

  it('hides stale confidence and evidence when a stored answer says material is insufficient', () => {
    render(
      <AnswerEvidence
        message={{
          answer: 'Material không đủ để trả lời câu hỏi.',
          mode: 'RAG',
          groundingType: 'COURSE_MATERIAL_WITH_APPROVED_KNOWLEDGE',
          confidence: 0.72,
          sources: ['material-1'],
          sourceEvidence: [{
            materialTitle: 'Senior-approved knowledge',
            excerpt: 'Fibonacci recursion repeats the same calculations and has poor performance.',
          }],
        }}
      />,
    );

    expect(screen.queryByRole('button', { name: /bằng chứng|nguồn tài liệu/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/72%/)).not.toBeInTheDocument();
  });

  it('does not present a truncated context tail as academic evidence', () => {
    render(
      <AnswerEvidence
        message={{
          mode: 'RAG',
          groundingType: 'COURSE_MATERIAL',
          sources: [],
          sourceEvidence: [{
            courseId: 'PRJ301',
            materialTitle: 'Main Material',
            pageStart: 14,
            pageEstimated: true,
            excerpt: 'clas',
          }],
        }}
      />,
    );

    expect(screen.queryByRole('button', { name: /bằng chứng|nguồn tài liệu/i })).not.toBeInTheDocument();
    expect(screen.queryByText('clas')).not.toBeInTheDocument();
  });

  it('does not present an estimated page as an exact citation', () => {
    render(
      <AnswerEvidence
        message={{
          mode: 'RAG',
          groundingType: 'COURSE_MATERIAL',
          sourceEvidence: [{
            courseId: 'PFP191',
            materialTitle: 'Main Material VN',
            pageStart: 16,
            pageEstimated: true,
            excerpt: 'Nếu điều gì đó có vẻ đặc biệt khó khăn thì hãy nghỉ ngơi và quay lại với cái nhìn mới mẻ.',
          }],
        }}
      />,
    );

    expect(screen.queryByText(/Main Material VN · Trang 16/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /bằng chứng tài liệu/i }));
    expect(screen.getByText('Chưa đối chiếu được với trang PDF gốc')).toBeVisible();
    expect(screen.queryByText(/Vị trí chính xác:\s*Trang PDF 16/)).not.toBeInTheDocument();
  });

  it('shows an exact page only after the excerpt was matched against the original PDF', () => {
    render(
      <AnswerEvidence
        message={{
          mode: 'RAG',
          groundingType: 'COURSE_MATERIAL',
          sourceEvidence: [{
            courseId: 'PFP191',
            materialTitle: 'Main Material VN',
            chapter: 'Dictionaries',
            pageStart: 112,
            pageEnd: 112,
            pageEstimated: false,
            excerpt: 'Dictionaries have a method called get that takes a key and a default value.',
          }],
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /bằng chứng tài liệu/i }));
    expect(screen.getByText((_, element) => (
      element?.tagName === 'SPAN'
      && element.textContent.includes('Vị trí chính xác: Trang PDF 112 · Dictionaries')
    ))).toBeVisible();
  });

  it('shows evidence material titles as plain text even when a material id exists', () => {
    const onDownloadSource = vi.fn();

    render(
      <AnswerEvidence
        message={{
          mode: 'RAG',
          groundingType: 'COURSE_MATERIAL',
          sourceEvidence: [{
            courseId: 'PRJ301',
            materialId: 'main-material-id',
            materialTitle: 'Main Material',
            excerpt: 'Servlet requests are handled through lifecycle methods including init service and destroy.',
          }],
        }}
        onDownloadSource={onDownloadSource}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /bằng chứng tài liệu \(1\)/i }));

    const materialTitle = screen.getByText('Main Material');
    expect(materialTitle).toBeVisible();
    expect(materialTitle.tagName).toBe('SPAN');
    expect(screen.queryByRole('button', { name: 'Main Material' })).not.toBeInTheDocument();
    expect(onDownloadSource).not.toHaveBeenCalled();
  });
});
