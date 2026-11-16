import { useState } from 'react';
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

function hintText({ reviewer, locked, fromStudent, selectedKey, revealReady }) {
  if (reviewer) {
    if (fromStudent) {
      return `Sinh viên đã chọn ${selectedKey}. Kết quả được giữ để bạn gửi chỉ dẫn cho AI Tutor lần sau.`;
    }
    if (locked) {
      return 'Bạn đã thử câu này. Sinh viên chưa nộp đáp án trên hệ thống.';
    }
    return 'Sinh viên chưa trả lời. Chọn 1 lần để tự thử; kết quả và giải thích được khóa, không ghi đè bài làm của sinh viên.';
  }
  if (locked && !revealReady) {
    return 'Đã lưu lựa chọn. Đúng/sai hiện khi bạn làm xong cả quiz và bài tập có hướng dẫn.';
  }
  if (locked) {
    return 'Đã khóa đáp án. Đúng/sai hiện trên câu này. AI Tutor giảng lại concept và chỗ sai ở tin nhắn tiếp theo.';
  }
  return 'Chọn một lần. Đúng/sai hiện khi bạn làm xong cả phần, và không đổi được sau khi chọn.';
}

function UnderstandingCheckQuiz({
  quiz,
  reviewer = false,
  lockedKey = '',
  attemptId = '',
  revealGrade = true,
  onLockAnswer,
}) {
  const studentKey = String(lockedKey || '').trim().toUpperCase();
  const selectionScope = storageKeyFor(attemptId, reviewer);
  const [localSelection, setLocalSelection] = useState(() => ({
    scope: selectionScope,
    key: readStoredKey(attemptId, reviewer),
  }));
  const [checkingMissingKey, setCheckingMissingKey] = useState(false);
  const [gradeResult, setGradeResult] = useState(null);
  const selectedKey = studentKey || (
    localSelection.scope === selectionScope
      ? localSelection.key
      : readStoredKey(attemptId, reviewer)
  );

  if (!quiz?.question || !Array.isArray(quiz.options) || quiz.options.length < 2) {
    return null;
  }

  const locked = Boolean(selectedKey);
  const fromStudent = Boolean(studentKey);
  const selected = quiz.options.find((item) => item.key === selectedKey);
  const correctKey = String(gradeResult?.correctKey || quiz.correctKey || '').toUpperCase();
  const explanation = gradeResult?.explanation || quiz.explanation || '';
  const hasKey = Boolean(correctKey);
  const isCorrect = hasKey && selectedKey === correctKey;
  const correctOption = quiz.options.find((item) => item.key === correctKey);
  const actor = reviewer && fromStudent ? 'Sinh viên' : 'Bạn';

  const lockAnswer = async (key) => {
    if (locked) return;
    const nextKey = String(key || '').trim().toUpperCase();
    if (!nextKey) return;
    setLocalSelection({ scope: selectionScope, key: nextKey });
    writeStoredKey(attemptId, reviewer, nextKey);
    if (!reviewer) {
      if (!quiz.correctKey) setCheckingMissingKey(true);
      const result = await onLockAnswer?.(nextKey, {
        quiz,
        selected: quiz.options.find((option) => option.key === nextKey),
        isCorrect: Boolean(quiz.correctKey) && nextKey === quiz.correctKey,
      });
      if (result) setGradeResult(result);
      setCheckingMissingKey(false);
    }
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
          <span>{hintText({ reviewer, locked, fromStudent, selectedKey, revealReady: revealGrade })}</span>
        </div>
        {reviewer && (
          <span className={`understanding-check__status ${fromStudent
            ? (hasKey ? (isCorrect ? 'is-correct' : 'is-wrong') : 'is-answered')
            : 'is-skipped'}`}
          >
            {fromStudent
              ? (hasKey ? (isCorrect ? 'Sinh viên: Đúng' : 'Sinh viên: Sai') : 'Sinh viên đã trả lời')
              : 'Sinh viên: Bỏ qua'}
          </span>
        )}
      </div>
      <p className="understanding-check__question">{quiz.question}</p>
      <div className="understanding-check__options">
        {quiz.options.map((option) => {
          const isSelected = selectedKey === option.key;
          const showGrade = locked && hasKey && revealGrade;
          const isRightChoice = option.key === correctKey;
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
      {selected && !revealGrade && (
        <div className="understanding-check__result">
          <strong>Đã lưu lựa chọn {selected.key}.</strong>
          <p>Đã lưu lựa chọn. Đúng/sai hiện khi bạn làm xong cả quiz và bài tập có hướng dẫn.</p>
        </div>
      )}
      {selected && revealGrade && (
        <div className={`understanding-check__result ${hasKey ? (isCorrect ? 'is-correct' : 'is-wrong') : ''}`}>
          {hasKey ? (
            <>
              <strong>{isCorrect ? 'Đúng rồi.' : 'Chưa đúng.'}</strong>
              <p>
                {isCorrect
                  ? `${actor} chọn ${selected.key}: ${selected.text}`
                  : `${actor} chọn ${selected.key}. Đáp án đúng là ${correctKey}${correctOption ? `: ${correctOption.text}` : ''}.`}
              </p>
              {explanation ? <p>{explanation}</p> : null}
            </>
          ) : (
            <>
              <strong>{actor} chọn {selected.key}.</strong>
              <p>Đang giữ lựa chọn. Đúng/sai hiện ngay trên câu này, không tạo câu trả lời mới.</p>
              {!reviewer && checkingMissingKey ? <span>Đang kiểm tra…</span> : null}
            </>
          )}
        </div>
      )}
    </section>
  );
}

export default UnderstandingCheckQuiz;
