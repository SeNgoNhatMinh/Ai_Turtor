import { useEffect, useState } from 'react';
import {
  filledPracticeMessage,
  readGuidedPracticeDraft,
  writeGuidedPracticeDraft,
} from '../guidedPracticeFill';
import './GuidedPracticeFill.css';

function initialValues(attemptId, inputCount) {
  const stored = readGuidedPracticeDraft(attemptId);
  const saved = Array.isArray(stored?.values) ? stored.values : [];
  return Array.from({ length: inputCount }, (_, index) => String(saved[index] || ''));
}

export default function GuidedPracticeFill({
  practice,
  reviewer = false,
  attemptId = '',
  waitsForQuiz = false,
  quizFinished = false,
  onSaved,
}) {
  const blankCount = Number(practice?.blankCount || 0);
  const inputCount = Math.max(blankCount, 1);
  const stored = reviewer ? null : readGuidedPracticeDraft(attemptId);
  const [values, setValues] = useState(() => (reviewer ? Array(inputCount).fill('') : initialValues(attemptId, inputCount)));
  const [savedText, setSavedText] = useState(() => (reviewer ? '' : String(stored?.text || '')));
  const [locked, setLocked] = useState(() => Boolean(stored?.locked));

  useEffect(() => {
    if (reviewer || !attemptId) return undefined;
    const sync = (event) => {
      if (String(event?.detail?.attemptId || '') !== String(attemptId)) return;
      const next = readGuidedPracticeDraft(attemptId);
      if (next?.locked) setLocked(true);
    };
    window.addEventListener('guided-practice-draft', sync);
    return () => window.removeEventListener('guided-practice-draft', sync);
  }, [attemptId, reviewer]);

  const filledValues = values.map((item) => item.trim());
  const complete = filledValues.every(Boolean);
  const currentText = complete
    ? filledPracticeMessage(practice, blankCount ? filledValues : filledValues[0])
    : '';
  const bothFinished = Boolean(savedText) && (!waitsForQuiz || quizFinished);
  const pendingChange = Boolean(savedText) && currentText !== savedText;
  const disabled = reviewer || locked || !complete || (Boolean(savedText) && !pendingChange);

  const save = (text = currentText) => {
    if (!text || locked || reviewer) return;
    const finished = !waitsForQuiz || quizFinished;
    writeGuidedPracticeDraft(attemptId, { values: filledValues, text, locked: finished });
    setSavedText(text);
    setLocked(finished);
    onSaved?.();
  };

  useEffect(() => {
    if (reviewer || locked || !quizFinished || !savedText) return;
    const storedDraft = readGuidedPracticeDraft(attemptId) || {};
    writeGuidedPracticeDraft(attemptId, {
      ...storedDraft,
      values: Array.isArray(storedDraft.values) ? storedDraft.values : [],
      text: savedText,
      locked: true,
    });
    setLocked(true);
  }, [attemptId, locked, quizFinished, reviewer, savedText]);

  const focusSibling = (input, offset) => {
    const inputs = [...(input?.parentElement?.querySelectorAll('input') || [])];
    const next = inputs[inputs.indexOf(input) + offset];
    if (next && !next.disabled) next.focus();
    else if (offset > 0) save();
  };

  const renderInput = (index) => (
    <input
      key={`blank-${index}`}
      className="guided-practice-fill__input"
      aria-label={`Chỗ trống ${index + 1}`}
      value={values[index] || ''}
      disabled={reviewer || locked}
      placeholder="điền vào đây"
      style={{ width: `${Math.max(10, String(values[index] || '').length + 2)}ch` }}
      onChange={(event) => {
        const next = [...values];
        next[index] = event.target.value;
        setValues(next);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          focusSibling(event.currentTarget, 1);
        }
      }}
    />
  );

  const buttonLabel = locked || bothFinished
    ? 'Đã nộp'
    : (savedText && !pendingChange ? 'Đã lưu bài làm' : (savedText ? 'Cập nhật bài làm' : 'Lưu bài làm'));

  return (
    <section className="guided-practice-fill" aria-label="Bài tập có hướng dẫn">
      <div className="guided-practice-fill__heading">
        <h3 className="ai-answer-heading">Bài tập có hướng dẫn</h3>
        <span>{filledValues.filter(Boolean).length}/{inputCount} chỗ</span>
      </div>
      {practice.prose ? <p className="guided-practice-fill__hint">{practice.prose}</p> : null}
      <p className="guided-practice-fill__hint">
        {waitsForQuiz
          ? 'Lưu bài làm chỉ giữ bản nháp. Làm xong quiz thì AI giảng lại các câu sai.'
          : 'Lưu bài làm tại đây. Phần này không tạo câu trả lời mới.'}
      </p>
      <pre className="guided-practice-fill__code">
        <code>
          {blankCount > 0 ? practice.segments.map((segment, index) => (
            segment.type === 'blank'
              ? renderInput(segment.index)
              : <span key={`text-${index}`}>{segment.text}</span>
          )) : (
            <>
              {practice.prefix || practice.code || practice.section}
              {renderInput(0)}
              {practice.suffix}
            </>
          )}
        </code>
      </pre>
      {!reviewer && (
        <div className="guided-practice-fill__actions">
          <button
            type="button"
            className="guided-practice-fill__submit"
            disabled={disabled}
            onClick={() => save()}
          >
            {buttonLabel}
          </button>
          {savedText && !locked && (
            <p className="guided-practice-fill__status">
              Đã lưu bài làm. Bạn vẫn sửa được cho đến khi làm xong cả quiz.
            </p>
          )}
          {locked && (
            <p className="guided-practice-fill__status">
              {waitsForQuiz
                ? 'Đã nộp. AI Tutor sẽ sửa bài tập và các câu sai.'
                : 'Đã lưu bài làm. Không tạo câu trả lời mới.'}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
