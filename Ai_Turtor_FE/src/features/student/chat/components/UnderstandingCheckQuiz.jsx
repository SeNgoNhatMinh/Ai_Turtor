import { useEffect, useState } from 'react';
import { CircleHelp } from 'lucide-react';

function storageKeyFor(attemptId, reviewer) {
  const id = String(attemptId || '').trim();
  if (!id) return '';
  return `understanding-check:${reviewer ? 'teacher' : 'student'}:${id}`;
}

function readStoredKey(attemptId, reviewer) {
  const storageKey = storageKeyFor(attemptId, reviewer);
  if (!storageKey || typeof window === 'undefined') return '';
  try {
    return String(window.localStorage.getItem(storageKey) || '').trim().toUpperCase();
  } catch {
    return '';
  }
}

function writeStoredKey(attemptId, reviewer, key) {
  const storageKey = storageKeyFor(attemptId, reviewer);
  if (!storageKey || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, key);
  } catch {
    // Private mode can block localStorage; the in-memory lock still holds.
  }
}

function hintText({ reviewer, locked, fromStudent, selectedKey }) {
  if (reviewer) {
    if (fromStudent) {
      return `Sinh viên đã chọn ${selectedKey}. Kết quả được giữ để bạn gửi chỉ dẫn cho AI Tutor lần sau.`;
    }
    if (locked) {
      return 'Bạn đã thử câu này. Sinh viên chưa nộp đáp án trên hệ thống.';
    }
    return 'Sinh viên chưa trả lời. Chọn 1 lần để tự thử; kết quả và giải thích được khóa, không ghi đè bài làm của sinh viên.';
  }
  if (locked) {
    return 'Đã khóa đáp án. Giáo viên xem được kết quả này để gửi chỉ dẫn cho lần học sau.';
  }
  return 'Chọn một lần. Kết quả đúng/sai và giải thích được giữ; không đổi được sau khi chọn.';
}

function UnderstandingCheckQuiz({
  quiz,
  reviewer = false,
  lockedKey = '',
  attemptId = '',
  onLockAnswer,
}) {
  const studentKey = String(lockedKey || '').trim().toUpperCase();
  const [selectedKey, setSelectedKey] = useState(
    () => studentKey || readStoredKey(attemptId, reviewer),
  );

  useEffect(() => {
    if (studentKey) setSelectedKey(studentKey);
  }, [studentKey]);

  if (!quiz?.question || !Array.isArray(quiz.options) || quiz.options.length < 2) {
    return null;
  }

  const locked = Boolean(selectedKey);
  const fromStudent = Boolean(studentKey);
  const selected = quiz.options.find((item) => item.key === selectedKey);
  const hasKey = Boolean(quiz.correctKey);
  const isCorrect = hasKey && selectedKey === quiz.correctKey;
  const correctOption = quiz.options.find((item) => item.key === quiz.correctKey);
  const actor = reviewer && fromStudent ? 'Sinh viên' : 'Bạn';

  const lockAnswer = (key) => {
    if (locked) return;
    const nextKey = String(key || '').trim().toUpperCase();
    if (!nextKey) return;
    setSelectedKey(nextKey);
    writeStoredKey(attemptId, reviewer, nextKey);
    if (!reviewer) onLockAnswer?.(nextKey);
  };

  return (
    <section
      className={`understanding-check${reviewer ? ' is-review' : ''}${locked ? ' is-locked' : ''}`}
      aria-label="Kiểm tra hiểu"
    >
      <div className="understanding-check__header">
        <CircleHelp size={16} aria-hidden="true" />
        <div>
          <strong>Kiểm tra hiểu</strong>
          <span>{hintText({ reviewer, locked, fromStudent, selectedKey })}</span>
        </div>
      </div>
      <p className="understanding-check__question">{quiz.question}</p>
      <div className="understanding-check__options">
        {quiz.options.map((option) => {
          const isSelected = selectedKey === option.key;
          const showGrade = locked && hasKey;
          const isRightChoice = option.key === quiz.correctKey;
          const className = [
            'understanding-check__option',
            isSelected ? 'is-selected' : '',
            showGrade && isRightChoice ? 'is-correct' : '',
            showGrade && isSelected && !isRightChoice ? 'is-wrong' : '',
          ].filter(Boolean).join(' ');
          return (
            <button
              type="button"
              key={option.key}
              className={className}
              disabled={locked}
              onClick={() => lockAnswer(option.key)}
            >
              <span>{option.key}</span>
              <em>{option.text}</em>
            </button>
          );
        })}
      </div>
      {selected && (
        <div className={`understanding-check__result ${hasKey ? (isCorrect ? 'is-correct' : 'is-wrong') : ''}`}>
          {hasKey ? (
            <>
              <strong>{isCorrect ? 'Đúng rồi.' : 'Chưa đúng.'}</strong>
              <p>
                {isCorrect
                  ? `${actor} chọn ${selected.key}: ${selected.text}`
                  : `${actor} chọn ${selected.key}. Đáp án đúng là ${quiz.correctKey}${correctOption ? `: ${correctOption.text}` : ''}.`}
              </p>
              {quiz.explanation ? <p>{quiz.explanation}</p> : null}
            </>
          ) : (
            <>
              <strong>{actor} chọn {selected.key}.</strong>
              <p>Câu này chưa kèm đáp án sẵn trong bài, nên chưa chấm được ngay.</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}

export default UnderstandingCheckQuiz;
