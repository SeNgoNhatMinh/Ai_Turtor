import { useState } from 'react';
import { CircleHelp } from 'lucide-react';
import MarkdownRenderer from '../../../../components/markdown/MarkdownRenderer';

function UnderstandingCheckQuiz({ quiz, onCheckAnswer }) {
  const [selectedKey, setSelectedKey] = useState('');
  const [checking, setChecking] = useState(false);
  const [tutorAnswer, setTutorAnswer] = useState('');
  const [checkError, setCheckError] = useState('');

  if (!quiz?.question || !Array.isArray(quiz.options) || quiz.options.length < 2) {
    return null;
  }

  const selected = quiz.options.find((item) => item.key === selectedKey);
  const hasKey = Boolean(quiz.correctKey);
  const isCorrect = hasKey && selectedKey === quiz.correctKey;
  const correctOption = quiz.options.find((item) => item.key === quiz.correctKey);
  const verdict = /chưa đúng|sai rồi|không đúng/i.test(tutorAnswer)
    ? 'is-wrong'
    : /đúng rồi|chính xác|^đúng\b/i.test(tutorAnswer)
      ? 'is-correct'
      : '';

  const selectOption = (key) => {
    setSelectedKey(key);
    setTutorAnswer('');
    setCheckError('');
  };

  const askTutor = async () => {
    if (!selected || !onCheckAnswer || checking) return;
    setChecking(true);
    setCheckError('');
    try {
      const answer = await onCheckAnswer(quiz, selected);
      setTutorAnswer(String(answer || '').trim());
    } catch (error) {
      setCheckError(error?.userMessage || error?.message || 'Không kiểm tra được đáp án. Thử lại nhé.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="understanding-check" aria-label="Kiểm tra hiểu">
      <div className="understanding-check__header">
        <CircleHelp size={16} aria-hidden="true" />
        <div>
          <strong>Kiểm tra hiểu</strong>
          <span>Quiz nhanh — chọn một đáp án để xem đúng sai.</span>
        </div>
      </div>
      <p className="understanding-check__question">{quiz.question}</p>
      <div className="understanding-check__options">
        {quiz.options.map((option) => {
          const isSelected = selectedKey === option.key;
          const showGrade = Boolean(selectedKey) && hasKey;
          const isRightChoice = option.key === quiz.correctKey;
          return (
            <button
              type="button"
              key={option.key}
              className={[
                'understanding-check__option',
                isSelected ? 'is-selected' : '',
                showGrade && isRightChoice ? 'is-correct' : '',
                showGrade && isSelected && !isRightChoice ? 'is-wrong' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => selectOption(option.key)}
            >
              <span>{option.key}</span>
              <em>{option.text}</em>
            </button>
          );
        })}
      </div>
      {selected && (
        <div className={`understanding-check__result ${hasKey ? (isCorrect ? 'is-correct' : 'is-wrong') : verdict}`}>
          {hasKey ? (
            <>
              <strong>{isCorrect ? 'Đúng rồi.' : 'Chưa đúng.'}</strong>
              <p>
                {isCorrect
                  ? `Đáp án ${selected.key}: ${selected.text}`
                  : `Bạn chọn ${selected.key}. Đáp án đúng là ${quiz.correctKey}${correctOption ? `: ${correctOption.text}` : ''}.`}
              </p>
            </>
          ) : (
            <>
              <strong>Bạn chọn {selected.key}.</strong>
              {!tutorAnswer && !checking ? (
                <p>Tutor sẽ chấm ngay trong ô này, không gửi xuống khung chat.</p>
              ) : null}
            </>
          )}
          {quiz.explanation && hasKey ? <p>{quiz.explanation}</p> : null}
          {!hasKey && onCheckAnswer && !tutorAnswer ? (
            <button
              type="button"
              className="understanding-check__ask"
              onClick={askTutor}
              disabled={checking}
            >
              {checking ? 'Đang chấm...' : 'Nhờ tutor kiểm tra'}
            </button>
          ) : null}
          {checkError ? <p className="understanding-check__error">{checkError}</p> : null}
          {tutorAnswer ? (
            <div className="understanding-check__tutor">
              <MarkdownRenderer markdown={tutorAnswer} hideSourceSection />
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

export default UnderstandingCheckQuiz;
