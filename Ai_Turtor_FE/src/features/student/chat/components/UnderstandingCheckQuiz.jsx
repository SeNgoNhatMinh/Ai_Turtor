import { useState } from 'react';
import { CircleHelp } from 'lucide-react';

function UnderstandingCheckQuiz({ quiz }) {
  const [selectedKey, setSelectedKey] = useState('');

  if (!quiz?.question || !Array.isArray(quiz.options) || quiz.options.length < 2) {
    return null;
  }

  const selected = quiz.options.find((item) => item.key === selectedKey);
  const hasKey = Boolean(quiz.correctKey);
  const isCorrect = hasKey && selectedKey === quiz.correctKey;
  const correctOption = quiz.options.find((item) => item.key === quiz.correctKey);

  const selectOption = (key) => {
    setSelectedKey(key);
  };

  return (
    <section className="understanding-check" aria-label="Kiểm tra hiểu">
      <div className="understanding-check__header">
        <CircleHelp size={16} aria-hidden="true" />
        <div>
          <strong>Kiểm tra hiểu</strong>
          <span>Chọn một đáp án để xem đúng sai và giải thích ngay, không gọi lại AI.</span>
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
        <div className={`understanding-check__result ${hasKey ? (isCorrect ? 'is-correct' : 'is-wrong') : ''}`}>
          {hasKey ? (
            <>
              <strong>{isCorrect ? 'Đúng rồi.' : 'Chưa đúng.'}</strong>
              <p>
                {isCorrect
                  ? `Đáp án ${selected.key}: ${selected.text}`
                  : `Bạn chọn ${selected.key}. Đáp án đúng là ${quiz.correctKey}${correctOption ? `: ${correctOption.text}` : ''}.`}
              </p>
              {quiz.explanation ? <p>{quiz.explanation}</p> : null}
            </>
          ) : (
            <>
              <strong>Bạn chọn {selected.key}.</strong>
              <p>Câu này chưa kèm đáp án sẵn trong bài, nên chưa chấm được ngay.</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}

export default UnderstandingCheckQuiz;
