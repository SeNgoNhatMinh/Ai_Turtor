import React from 'react';
import { Code2, HelpCircle, LifeBuoy, ListChecks, Wand2 } from 'lucide-react';

const ACTIONS = [
  {
    label: 'Explain simpler',
    icon: Wand2,
    buildPrompt: (message) => `Explain this answer in simpler words:\n\n${message.answer || message.question || ''}`,
  },
  {
    label: 'Give example',
    icon: HelpCircle,
    buildPrompt: (message) => `Give me a practical example for this answer:\n\n${message.answer || message.question || ''}`,
  },
  {
    label: 'Create practice question',
    icon: ListChecks,
    buildPrompt: (message) => `Create one practice question based on this topic and include the expected answer:\n\n${message.question || message.answer || ''}`,
  },
  {
    label: 'Review my code',
    icon: Code2,
    buildPrompt: () => 'I want to review my code. Please tell me what code or error log I should paste.',
  },
  {
    label: 'Ask mentor',
    icon: LifeBuoy,
    type: 'mentor',
    buildPrompt: (message) => `I need mentor support for this question:\n\n${message.question || ''}`,
  },
];

function AnswerActionBar({ message, onAction }) {
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
