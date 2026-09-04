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

function AnswerImproveSuggestions({
  suggestions = [],
  onStudy,
  onCreateQuiz,
  sourceMode,
  readOnly = false,
  heading = 'Tiếp tục học',
  hint = 'Chọn nội dung bạn muốn học tiếp từ câu trả lời này.',
}) {
  const uniqueSuggestions = [...new Map(
    (Array.isArray(suggestions) ? suggestions : [])
      .map((suggestion) => [getSuggestionText(suggestion).toLowerCase(), suggestion])
      .filter(([key]) => key),
  ).values()].slice(0, 8);

  if (uniqueSuggestions.length === 0) return null;

  return (
    <section className="answer-improve-suggestions" aria-label={heading}>
      <div className="answer-improve-suggestions__header">
        <strong>{heading}</strong>
        <span>{hint}</span>
      </div>
      <div className="answer-improve-suggestions__list">
        {uniqueSuggestions.map((suggestion) => {
          const text = getSuggestionText(suggestion);
          return (
            <article key={text.toLowerCase()} className="answer-improve-suggestion">
              <span>{text}</span>
              {!readOnly && (onStudy || onCreateQuiz) ? (
                <div className="answer-improve-suggestion__actions">
                  {onStudy && (
                    <button
                      type="button"
                      onClick={() => onStudy({
                        ...(suggestion && typeof suggestion === 'object' ? suggestion : {}),
                        text,
                        sourceMode,
                      })}
                    >
                      <BookOpenCheck size={14} aria-hidden="true" /> Học ngay
                    </button>
                  )}
                  {onCreateQuiz && (
                    <button type="button" onClick={() => onCreateQuiz(text)}>
                      <ClipboardList size={14} aria-hidden="true" /> Tạo quiz
                    </button>
                  )}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default AnswerImproveSuggestions;
