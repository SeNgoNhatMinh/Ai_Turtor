import React from 'react';
import { BookOpen, Code2, GraduationCap, MessagesSquare } from 'lucide-react';

const PROMPTS = [
  {
    title: 'Explain a concept',
    prompt: 'Explain the most important concept in this lesson with a simple example.',
    icon: BookOpen,
  },
  {
    title: 'Review my code',
    prompt: 'Help me review this code and explain what I should improve.',
    icon: Code2,
  },
  {
    title: 'Summarize lesson',
    prompt: 'Summarize the key points I should remember for this course.',
    icon: GraduationCap,
  },
  {
    title: 'Ask mentor',
    prompt: 'I need mentor support for this question. Please help me describe the issue clearly.',
    icon: MessagesSquare,
  },
];

function PromptStarters({ onSelect }) {
  return (
    <div className="prompt-starters" aria-label="Prompt starters">
      {PROMPTS.map(({ title, prompt, icon: Icon }) => (
        <button key={title} type="button" className="prompt-starter-card" onClick={() => onSelect(prompt)}>
          <Icon size={16} aria-hidden="true" />
          <span>{title}</span>
        </button>
      ))}
    </div>
  );
}

export default PromptStarters;
