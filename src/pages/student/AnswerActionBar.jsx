import { LifeBuoy, RotateCcw } from 'lucide-react';

const ACTIONS = [
  {
    label: 'Gửi mentor xem xét',
    icon: LifeBuoy,
    type: 'mentor',
    buildPrompt: (message) => `I need mentor review for this question:\n\n${message.question || ''}`,
  },
];

const isInsufficientMaterialAnswer = (message) => {
  const text = String(message?.answer || message?.rawAnswer || '').toLowerCase();
  return (
    text.includes('không có nội dung đủ phù hợp') ||
    text.includes('chưa có tài liệu') ||
    text.includes('not enough course material') ||
    text.includes('not enough indexed course material')
  );
};

function AnswerActionBar({ message, onAction }) {
  if (message?.retryable || message?.aiServiceError) {
    const retryPrompt = message?.question || '';
    return (
      <div className="answer-action-bar answer-action-bar--error" aria-label="Thao tác khôi phục">
        <button
          type="button"
          onClick={() => onAction({ label: 'Thử lại', prompt: retryPrompt, type: 'retry', message })}
          disabled={!retryPrompt.trim()}
        >
          <RotateCcw size={14} aria-hidden="true" />
          <span>Thử lại</span>
        </button>
        <button
          type="button"
          onClick={() => onAction({
            label: 'Gửi mentor xem xét',
            prompt: `I need mentor review for this question:\n\n${retryPrompt}`,
            type: 'mentor',
            message,
          })}
          disabled={!retryPrompt.trim()}
        >
          <LifeBuoy size={14} aria-hidden="true" />
          <span>Gửi xem xét</span>
        </button>
      </div>
    );
  }

  if (isInsufficientMaterialAnswer(message)) {
    const question = message?.question || '';
    return (
      <div className="answer-action-bar answer-action-bar--error" aria-label="Thao tác hỗ trợ từ mentor">
        <button
          type="button"
          onClick={() => onAction({
            label: 'Gửi mentor xem xét',
            prompt: `I need mentor review for this question:\n\n${question}`,
            type: 'mentor',
            message,
          })}
          disabled={!question.trim()}
        >
          <LifeBuoy size={14} aria-hidden="true" />
          <span>Gửi xem xét</span>
        </button>
      </div>
    );
  }

  return (
    <div className="answer-action-bar" aria-label="Thao tác tiếp theo">
      {ACTIONS.map(({ label, icon: Icon, buildPrompt, type }) => (
        <button key={label} type="button" onClick={() => onAction({ label, prompt: buildPrompt(message), type, message })}>
          <Icon size={14} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

export default AnswerActionBar;
