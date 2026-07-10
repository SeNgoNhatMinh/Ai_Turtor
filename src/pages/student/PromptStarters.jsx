import React from 'react';
import { BookOpen, Code2, GraduationCap, MessagesSquare } from 'lucide-react';

const PROMPTS = [
  {
    title: 'Giải thích khái niệm',
    prompt: 'Hãy giải thích khái niệm quan trọng nhất trong bài học này kèm theo ví dụ đơn giản.',
    icon: BookOpen,
  },
  {
    title: 'Xem lại code',
    prompt: 'Giúp tôi kiểm tra đoạn code này và giải thích những chỗ cần cải thiện.',
    icon: Code2,
  },
  {
    title: 'Tóm tắt bài học',
    prompt: 'Tóm tắt những điểm chính tôi cần ghi nhớ cho khóa học này.',
    icon: GraduationCap,
  },
  {
    title: 'Hỏi Mentor',
    prompt: 'Tôi cần mentor hỗ trợ cho câu hỏi này. Hãy giúp tôi mô tả vấn đề rõ ràng hơn.',
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
