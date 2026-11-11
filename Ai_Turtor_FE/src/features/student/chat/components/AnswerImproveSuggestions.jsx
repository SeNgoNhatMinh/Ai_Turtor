import { BookOpenCheck, CheckCircle2, ClipboardList } from 'lucide-react';
import {
  getStudySuggestionKey,
  getStudySuggestionText,
} from '../../learning/studySuggestionProgress';

function AnswerImproveSuggestions({
  suggestions = [],
  onStudy,
  onCreateQuiz,
  sourceMode,
  readOnly = false,
  learnedSuggestionKeys = [],
  currentLearnedSuggestion,
  heading = 'Tiếp tục học',
  hint = 'Chọn nội dung bạn muốn học tiếp từ câu trả lời này.',
}) {
  const learnedKeys = new Set(
    (Array.isArray(learnedSuggestionKeys) ? learnedSuggestionKeys : [])
      .map((key) => String(key || '').trim())
      .filter(Boolean),
  );
  const candidates = currentLearnedSuggestion
    ? [currentLearnedSuggestion, ...(Array.isArray(suggestions) ? suggestions : [])]
    : suggestions;
  const uniqueSuggestions = [...new Map(
    (Array.isArray(candidates) ? candidates : [])
      .map((suggestion) => [
        getStudySuggestionText(suggestion).normalize('NFKC').trim().toLowerCase(),
        suggestion,
      ])
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
          const text = getStudySuggestionText(suggestion);
          const suggestionKey = getStudySuggestionKey(suggestion);
          const isLearned = learnedKeys.has(suggestionKey);
          return (
            <article key={suggestionKey} className="answer-improve-suggestion">
              <span>{text}</span>
              {isLearned ? (
                <span className="answer-improve-suggestion__learned" aria-label={`${text} - Đã học`}>
                  <CheckCircle2 size={14} aria-hidden="true" /> Đã học
                </span>
              ) : !readOnly && (onStudy || onCreateQuiz) ? (
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
                      <ClipboardList size={14} aria-hidden="true" /> Ôn tập
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
