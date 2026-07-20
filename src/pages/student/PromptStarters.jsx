import { BookOpen, Code2, GraduationCap } from 'lucide-react';

const PROMPTS = [
  {
    title: 'Giải thích khái niệm',
    prompt: 'Dựa trên tài liệu môn học, hãy chọn một khái niệm nền tảng quan trọng và giải thích bằng một ví dụ đơn giản.',
    icon: BookOpen,
  },
  {
    title: 'Kiểm tra mã nguồn',
    prompt: 'Dựa trên tài liệu môn học, hãy đưa ra một ví dụ mã nguồn tiêu biểu, sau đó phân tích cách hoạt động và những điểm có thể cải thiện.',
    icon: Code2,
  },
  {
    title: 'Tóm tắt bài học',
    prompt: 'Dựa trên tài liệu môn học, hãy tóm tắt những nội dung quan trọng tôi cần ghi nhớ và gợi ý thứ tự ôn tập.',
    icon: GraduationCap,
  },
];

function PromptStarters({ disabled = false, onSelect }) {
  return (
    <div className="prompt-starters" aria-label="Câu hỏi gợi ý">
      {PROMPTS.map(({ title, prompt, icon: Icon }) => (
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
