import './TeacherPracticeEvidence.css';

function Badge({ correct }) {
  if (correct === undefined) return <span className="practice-evidence__badge is-pending">Chưa chấm</span>;
  return (
    <span className={`practice-evidence__badge ${correct ? 'is-correct' : 'is-wrong'}`}>
      {correct ? 'Đúng' : 'Chưa đúng'}
    </span>
  );
}

/**
 * Teacher-facing card for the hidden work-review turn: the student's filled blanks with the AI
 * grade beside each, then the wrong quiz choices. Replaces the raw instruction prompt bubble.
 */
export default function TeacherPracticeEvidence({ submission, values }) {
  if (!submission) return null;
  const { concept, code, quizMistakes, quizAllCorrect, grades } = submission;
  const rows = Array.isArray(values) && values.length
    ? values.map((value, index) => ({ value, grade: grades[index] }))
    : [];
  const gradedRight = grades.filter((grade) => grade.correct).length;
  const blankTotal = rows.length || grades.length;

  return (
    <section className="practice-evidence" aria-label="Bằng chứng bài làm của sinh viên">
      <header className="practice-evidence__header">
        <strong>Bài nộp: bài tập có hướng dẫn + quiz</strong>
        <div className="practice-evidence__summary">
          {blankTotal > 0 && grades.length > 0 && (
            <span className={`practice-evidence__chip ${gradedRight === grades.length ? 'is-correct' : 'is-wrong'}`}>
              Bài tập: {gradedRight}/{grades.length} chỗ đúng
            </span>
          )}
          <span className={`practice-evidence__chip ${quizMistakes.length ? 'is-wrong' : 'is-correct'}`}>
            {quizMistakes.length
              ? `Quiz: ${quizMistakes.length} câu sai`
              : (quizAllCorrect ? 'Quiz: đúng hết' : 'Quiz: không có câu sai')}
          </span>
        </div>
      </header>

      {concept && (
        <p className="practice-evidence__concept">
          <span>Concept đã hỏi</span>
          {concept}
        </p>
      )}

      <div className="practice-evidence__block">
        <h4>Chỗ sinh viên điền</h4>
        {rows.length > 0 ? (
          <table className="practice-evidence__table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Sinh viên điền</th>
                <th scope="col">AI chấm</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`blank-${index}`} className={row.grade && !row.grade.correct ? 'is-wrong' : ''}>
                  <td>{index + 1}</td>
                  <td><code>{row.value || '(bỏ trống)'}</code></td>
                  <td>
                    <Badge correct={row.grade?.correct} />
                    {row.grade && !row.grade.correct && row.grade.note
                      ? <p className="practice-evidence__note">{row.grade.note}</p>
                      : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : code ? (
          <>
            <pre className="practice-evidence__code"><code>{code}</code></pre>
            {grades.length > 0 && (
              <ul className="practice-evidence__grades">
                {grades.map((grade, index) => (
                  <li key={`grade-${index}`}>
                    <Badge correct={grade.correct} /> {grade.note}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="practice-evidence__empty">Không đọc được phần bài làm đã nộp.</p>
        )}
      </div>

      {quizMistakes.length > 0 && (
        <div className="practice-evidence__block">
          <h4>Câu trắc nghiệm sai</h4>
          <ol className="practice-evidence__quiz">
            {quizMistakes.map((item, index) => (
              <li key={`quiz-${index}`}>
                <p className="practice-evidence__question">{item.question}</p>
                <p><span className="practice-evidence__label is-wrong">Đã chọn</span> {item.chosen}</p>
                {item.correct && (
                  <p><span className="practice-evidence__label is-correct">Đáp án đúng</span> {item.correct}</p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
