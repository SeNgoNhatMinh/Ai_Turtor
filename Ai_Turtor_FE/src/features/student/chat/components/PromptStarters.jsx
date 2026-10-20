import { BookOpen, Code2, GraduationCap } from 'lucide-react';

const ICONS = [BookOpen, GraduationCap, Code2];

const topicTitle = (topic) => String(
  typeof topic === 'string' ? topic : topic?.title || topic?.suggestionText || '',
).trim();

/**
 * Starter prompts are generated from the course's syllabus topics (supplied
 * by the tutor session). Without syllabus topics there is nothing grounded
 * to suggest, so only a neutral "ask about the syllabus" starter is shown
 * instead of invented, course-agnostic content.
 */
function buildPrompts(topics) {
  const titles = (Array.isArray(topics) ? topics : [])
    .map(topicTitle)
    .filter(Boolean)
    .slice(0, 3);
  if (titles.length === 0) {
    return [{
      title: 'Hỏi về nội dung môn học',
      prompt: 'Hãy cho mình biết môn học này gồm những nội dung nào theo syllabus chính thức.',
      icon: BookOpen,
    }];
  }
  return titles.map((title, index) => ({
    title,
    prompt: index === 1
      ? `Dựa trên tài liệu môn học, hãy tóm tắt những ý cần nhớ về "${title}" và gợi ý thứ tự ôn tập.`
      : `Dựa trên tài liệu môn học, hãy giải thích "${title}" bằng một ví dụ đơn giản.`,
    icon: ICONS[index % ICONS.length],
  }));
}

function PromptStarters({ disabled = false, onSelect, topics = [] }) {
  const prompts = buildPrompts(topics);
  return (
    <div className="prompt-starters" aria-label="Câu hỏi gợi ý">
      {prompts.map(({ title, prompt, icon: Icon }) => (
        <button
          key={title}
          type="button"
          className="prompt-starter-card"
          disabled={disabled || !onSelect}
          onClick={() => onSelect(prompt)}
        >
          <Icon size={16} aria-hidden="true" />
          <span>{title}</span>
        </button>
      ))}
    </div>
  );
}

export default PromptStarters;
