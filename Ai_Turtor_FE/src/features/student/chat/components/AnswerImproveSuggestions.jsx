import { useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, ClipboardList, Search, ChevronUp } from 'lucide-react';

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
  pageSize = 8,
  showMoreLabel = 'Hiển thị thêm',
  collapseLabel = 'Ẩn bớt',
  enableSearch = false,
  searchPlaceholder = 'Tìm chương…',
}) {
  const uniqueSuggestions = useMemo(() => [...new Map(
    (Array.isArray(suggestions) ? suggestions : [])
      .map((suggestion) => [getSuggestionText(suggestion).toLowerCase(), suggestion])
      .filter(([key]) => key),
  ).values()], [suggestions]);

  const step = Math.max(1, Number(pageSize) || 8);
  const [visibleCount, setVisibleCount] = useState(Math.min(step, uniqueSuggestions.length));
  const [query, setQuery] = useState('');

  const filteredSuggestions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return uniqueSuggestions;
    return uniqueSuggestions.filter((suggestion) => (
      getSuggestionText(suggestion).toLowerCase().includes(needle)
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
