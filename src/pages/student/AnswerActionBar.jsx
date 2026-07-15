import { LifeBuoy, RotateCcw, Wand2 } from 'lucide-react';

const trimText = (value, maxLength = 420) => {
  const text = String(value || '')
    .replace(/[#*_`>|[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
};

const getOriginalQuestion = (message) => trimText(message?.question || message?.prompt || '', 260);

const buildGroundedFollowUpPrompt = (message, task) => {
  const originalQuestion = getOriginalQuestion(message);
  const answerContext = trimText(message?.answer || message?.rawAnswer || '', 420);
  const topicContext = originalQuestion || answerContext;

  return [
    `Original student question: ${topicContext}`,
    '',
    `Task: ${task}`,
    '',
    'Use the same course material context. If the material is not enough, say exactly what is missing instead of inventing details.',
    answerContext && originalQuestion ? `Previous answer context: ${answerContext}` : '',
  ].filter(Boolean).join('\n');
};

const ACTIONS = [
  {
    label: 'Giải thích đơn giản hơn',
    icon: Wand2,
    buildPrompt: (message) => buildGroundedFollowUpPrompt(
      message,
      'Explain the same topic in simpler words, step by step, for a beginner.',
    ),
  },
  {
    label: 'Gửi mentor review',
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
      <div className="answer-action-bar answer-action-bar--error" aria-label="Recovery actions">
        <button
          type="button"
          onClick={() => onAction({ label: 'Retry', prompt: retryPrompt, type: 'retry', message })}
          disabled={!retryPrompt.trim()}
        >
          <RotateCcw size={14} aria-hidden="true" />
          <span>Retry</span>
        </button>
        <button
          type="button"
          onClick={() => onAction({
            label: 'Send for mentor review',
            prompt: `I need mentor review for this question:\n\n${retryPrompt}`,
            type: 'mentor',
            message,
          })}
          disabled={!retryPrompt.trim()}
        >
          <LifeBuoy size={14} aria-hidden="true" />
          <span>Send for review</span>
        </button>
      </div>
    );
  }

  if (isInsufficientMaterialAnswer(message)) {
    const question = message?.question || '';
    return (
      <div className="answer-action-bar answer-action-bar--error" aria-label="Mentor support action">
        <button
          type="button"
          onClick={() => onAction({
            label: 'Send for mentor review',
            prompt: `I need mentor review for this question:\n\n${question}`,
            type: 'mentor',
            message,
          })}
          disabled={!question.trim()}
        >
          <LifeBuoy size={14} aria-hidden="true" />
          <span>Send for review</span>
        </button>
      </div>
    );
  }

  return (
    <div className="answer-action-bar" aria-label="Follow-up actions">
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
