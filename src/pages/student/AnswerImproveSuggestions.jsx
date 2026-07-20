import { BookOpenCheck, ClipboardList } from 'lucide-react';

const getSuggestionText = (suggestion) => String(
  suggestion?.suggestionText
  || suggestion?.title
  || suggestion?.topic
  || suggestion?.content
  || suggestion?.text
  || suggestion
  || '',
).trim();

function AnswerImproveSuggestions({ suggestions = [], onStudy, onCreateQuiz }) {
  const uniqueSuggestions = [...new Map(
    (Array.isArray(suggestions) ? suggestions : [])
      .map((suggestion) => [getSuggestionText(suggestion).toLowerCase(), suggestion])
      .filter(([key]) => key),
  ).values()].slice(0, 4);

  if (uniqueSuggestions.length === 0) return null;

  return (
    <section className="answer-improve-suggestions" aria-label="Gợi ý bước học tiếp theo">
      <div className="answer-improve-suggestions__header">
        <strong>Tiếp tục học</strong>
        <span>Chọn nội dung bạn muốn học tiếp từ câu trả lời này.</span>
      </div>
      <div className="answer-improve-suggestions__list">
        {uniqueSuggestions.map((suggestion) => {
          const text = getSuggestionText(suggestion);
          return (
            <article key={text.toLowerCase()} className="answer-improve-suggestion">
              <span>{text}</span>
              <div className="answer-improve-suggestion__actions">
                {onStudy && (
                  <button type="button" onClick={() => onStudy(text)}>
                    <BookOpenCheck size={14} aria-hidden="true" /> Học ngay
                  </button>
                )}
                {onCreateQuiz && (
                  <button type="button" onClick={() => onCreateQuiz(text)}>
                    <ClipboardList size={14} aria-hidden="true" /> Tạo quiz
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default AnswerImproveSuggestions;
