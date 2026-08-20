import { Bot } from 'lucide-react';
import CopyButton from '../../../components/markdown/CopyButton';
import MarkdownRenderer from '../../../components/markdown/MarkdownRenderer';

export default function CachedAnswerPreview({ answer, original = false }) {
  const safeAnswer = String(answer || '').trim();

  return (
    <section className={`answer-cache-preview ${original ? 'answer-cache-preview--original' : ''}`}>
      <header className="answer-cache-preview__header">
        <span className="answer-cache-preview__avatar" aria-hidden="true">
          <Bot size={18} />
        </span>
        <span className="answer-cache-preview__identity">
          <strong>{original ? 'Câu trả lời gốc' : 'AI Tutor'}</strong>
          <small>{original ? 'Trước khi Senior chỉnh sửa' : 'Câu trả lời sinh viên đang nhận từ cache'}</small>
        </span>
        {safeAnswer && <CopyButton text={safeAnswer} />}
      </header>
      <div className="answer-cache-preview__content">
        <MarkdownRenderer markdown={safeAnswer || 'Không có nội dung câu trả lời.'} />
      </div>
    </section>
  );
}
