import { useMemo, useState } from 'react';
import { Alert, Button, Card, Progress, Radio, Spin } from 'antd';
import {
  getQuestionChoices,
  getQuestionId,
  getQuestionName,
  getQuestionText,
  getQuizQuestions,
  getQuizSessionId,
} from '../../features/student/quizzes/quizQuestionUtils';

export default function QuizRunner({ quiz, onSubmit, submitting = false }) {
  const [answers, setAnswers] = useState({});
  const [isSending, setIsSending] = useState(false);
  const questions = getQuizQuestions(quiz);
  const quizSessionId = getQuizSessionId(quiz);
  const gradingMode = String(quiz?.gradingMode || '').toUpperCase();
  const isTeacherOnlineQuiz = gradingMode === 'TEACHER_MANUAL' || gradingMode === 'AI_ASSISTED';
  const answeredCount = Object.keys(answers).length;
  const progressPercent = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;

  const canSubmit = useMemo(() => Boolean(
    quizSessionId
    && questions.length
    && questions.every((question, index) => answers[getQuestionName(question, index)]),
  ), [answers, questions, quizSessionId]);

  const handleSubmit = async () => {
    if (!canSubmit || submitting || isSending) return;

    const payload = {
      answers: questions.map((question, index) => ({
        questionId: getQuestionId(question, index),
        selectedAnswer: answers[getQuestionName(question, index)],
      })),
    };

    setIsSending(true);
    try {
      await onSubmit?.(quizSessionId, payload);
    } finally {
      setIsSending(false);
    }
  };

  if (!quiz) return null;

  const submitPending = submitting || isSending;
  const gradingDescription = isTeacherOnlineQuiz
    ? gradingMode === 'TEACHER_MANUAL'
      ? 'Lựa chọn của bạn sẽ được lưu. Giảng viên sẽ chấm và xác nhận điểm cuối cùng.'
      : 'Backend sẽ đối chiếu đáp án và đưa điểm gợi ý. Giảng viên xác nhận điểm cuối cùng.'
    : 'Đáp án được ẩn cho đến khi bạn nộp quiz.';

  return (
    <div className="quiz-runner">
      <Card className="quiz-runner-overview" title={quiz.title || 'Quiz luyện tập'}>
        <p>{gradingDescription}</p>
        <div className="quiz-runner-progress">
          <strong>Đã trả lời {answeredCount}/{questions.length} câu</strong>
          <Progress percent={progressPercent} showInfo={false} strokeColor="#f37021" />
        </div>
      </Card>

      {!questions.length && (
        <Alert
          showIcon
          type="warning"
          title="Backend chưa trả câu hỏi quiz"
          description="Có thể chưa đủ tài liệu môn học đã lập chỉ mục để tạo quiz này."
        />
      )}

      {submitPending ? (
        <Card className="quiz-runner-submitting" aria-live="polite">
          <Spin size="large" />
          <strong>Đang nộp quiz...</strong>
          <span>Bài làm đang được gửi tới backend.</span>
        </Card>
      ) : (
        <div className="quiz-runner-question-list">
          {questions.map((question, index) => {
            const questionName = getQuestionName(question, index);
            const choices = getQuestionChoices(question);
            return (
              <Card
                key={getQuestionId(question, index)}
                className="quiz-runner-question"
                title={<><span>{index + 1}.</span> {getQuestionText(question, index)}</>}
              >
                <Radio.Group
                  className="quiz-runner-options"
                  value={answers[questionName]}
                  onChange={(event) => setAnswers((current) => ({
                    ...current,
                    [questionName]: event.target.value,
                  }))}
                  aria-label={`Câu ${index + 1}`}
                >
                  {choices.map((choice) => (
                    <Radio
                      key={choice.value}
                      value={choice.value}
                      className={answers[questionName] === choice.value ? 'is-selected' : ''}
                    >
                      {choice.text}
                    </Radio>
                  ))}
                </Radio.Group>
              </Card>
            );
          })}

          {questions.length > 0 && (
            <div className="quiz-runner-submit">
              <Button
                type="primary"
                size="large"
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                Nộp quiz
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
