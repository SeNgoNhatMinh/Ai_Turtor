import { useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, CheckCircle2, ClipboardList, Search, ChevronUp } from 'lucide-react';
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
  pageSize = 8,
  showMoreLabel = 'Hiển thị thêm',
  collapseLabel = 'Ẩn bớt',
  enableSearch = false,
  searchPlaceholder = 'Tìm chương…',
  actionsLocked = false,
  activeSuggestionKey = '',
}) {
  const learnedKeys = useMemo(() => new Set(
    (Array.isArray(learnedSuggestionKeys) ? learnedSuggestionKeys : [])
      .map((key) => String(key || '').trim())
      .filter(Boolean),
  ), [learnedSuggestionKeys]);
  const candidates = currentLearnedSuggestion
    ? [currentLearnedSuggestion, ...(Array.isArray(suggestions) ? suggestions : [])]
    : suggestions;
  const uniqueSuggestions = useMemo(() => [...new Map(
    (Array.isArray(candidates) ? candidates : [])
      .map((suggestion) => [getStudySuggestionText(suggestion).normalize('NFKC').trim().toLowerCase(), suggestion])
      .filter(([key]) => key),
  ).values()], [candidates]);

  const step = Math.max(1, Number(pageSize) || 8);
  const [visibleCount, setVisibleCount] = useState(Math.min(step, uniqueSuggestions.length));
  const [query, setQuery] = useState('');

  const filteredSuggestions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return uniqueSuggestions;
    return uniqueSuggestions.filter((suggestion) => (
      getStudySuggestionText(suggestion).toLowerCase().includes(needle)
    ));
  }, [query, uniqueSuggestions]);

  useEffect(() => {
    setVisibleCount(Math.min(step, filteredSuggestions.length));
  }, [step, filteredSuggestions.length, heading, query]);

  if (uniqueSuggestions.length === 0) return null;

  const visibleSuggestions = filteredSuggestions.slice(0, visibleCount);
  const hasMore = visibleCount < filteredSuggestions.length;
  const canCollapse = visibleCount > step;

  return (
    <section className="answer-improve-suggestions" aria-label={heading}>
      <div className="answer-improve-suggestions__header">
        <strong>{heading}</strong>
        <span>{hint}</span>
      </div>
      {enableSearch ? (
        <div className="answer-improve-suggestions__toolbar">
          <label className="answer-improve-suggestions__search">
            <Search size={13} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
            />
          </label>
        </div>
      ) : null}
      <div className="answer-improve-suggestions__list">
        {visibleSuggestions.length === 0 ? (
          <p className="answer-improve-suggestions__empty">Không tìm thấy chương phù hợp.</p>
        ) : visibleSuggestions.map((suggestion) => {
          const text = getStudySuggestionText(suggestion);
          const suggestionKey = getStudySuggestionKey(suggestion);
          const isLearned = learnedKeys.has(suggestionKey);
          const isActiveRequest = Boolean(activeSuggestionKey) && suggestionKey === activeSuggestionKey;
          const dimmed = actionsLocked && !isActiveRequest;
          return (
            <article
              key={suggestionKey || text.toLowerCase()}
              className={`answer-improve-suggestion${dimmed ? ' is-dimmed' : ''}${isActiveRequest ? ' is-active' : ''}`}
            >
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
                      disabled={actionsLocked}
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
      {(hasMore || canCollapse) ? (
        <div className="answer-improve-suggestions__footer">
          {hasMore ? (
            <button
              type="button"
              className="answer-improve-suggestions__more"
              onClick={() => setVisibleCount((count) => Math.min(count + step, filteredSuggestions.length))}
            >
              {showMoreLabel} ({Math.min(step, filteredSuggestions.length - visibleCount)})
            </button>
          ) : null}
          {canCollapse ? (
            <button
              type="button"
              className="answer-improve-suggestions__collapse"
              onClick={() => setVisibleCount(step)}
            >
              <ChevronUp size={13} aria-hidden="true" />
              {collapseLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default AnswerImproveSuggestions;
