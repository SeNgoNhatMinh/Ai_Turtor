import { CheckCircle, XCircle } from 'lucide-react';
import { Alert, Tag } from 'antd';
import { getQuizReviewDetails } from '../../../student/quizzes/quizQuestionUtils';

function formatReviewTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

function QuizQuestionReview({ question, answer, index, allowAnswerKey }) {
  const review = getQuizReviewDetails(question, answer);
  const canShowAnswerKey = allowAnswerKey && Boolean(review.correctAnswer);
  return (
    <div className="quiz-review-item quiz-teacher-review-item">
      <div className="quiz-review-question-heading">
        <div className="quiz-review-question">
          <strong>Câu {index + 1}</strong>
          <span>{question.questionText}</span>
        </div>
        {canShowAnswerKey && (
          <Tag color={review.isCorrect ? 'green' : 'red'} icon={review.isCorrect ? <CheckCircle size={13} /> : <XCircle size={13} />}>
            {review.isCorrect ? 'Đúng' : 'Sai'}
          </Tag>
        )}
      </div>
      <div className="quiz-review-answer-grid">
        <span className="quiz-review-options-label">Các lựa chọn</span>
        <ul className="quiz-review-options">
          {review.choices.map((choice, optionIndex) => {
            const stateClass = canShowAnswerKey && choice.isCorrectAnswer
              ? 'quiz-review-option--correct'
              : canShowAnswerKey && choice.isSelected
                ? 'quiz-review-option--incorrect'
                : '';
            return (
              <li key={`${question.questionId || index}-${choice.value}-${optionIndex}`} className={`quiz-review-option ${stateClass}`}>
                <span className="quiz-review-option-marker">{String.fromCharCode(65 + optionIndex)}</span>
                <span className="quiz-review-option-text">{choice.text}</span>
                <span className="quiz-review-option-tags">
                  {choice.isSelected && <Tag color={canShowAnswerKey ? (review.isCorrect ? 'green' : 'red') : 'blue'}>Sinh viên đã chọn</Tag>}
                  {canShowAnswerKey && choice.isCorrectAnswer && <Tag color="green">Đáp án đúng</Tag>}
                </span>
              </li>
            );
          })}
        </ul>
        {!review.selectedAnswer && <span className="quiz-review-unanswered">Sinh viên chưa trả lời câu này.</span>}
        {canShowAnswerKey && review.explanation && (
          <div className="quiz-review-explanation">
            <strong>Giải thích</strong>
            <span>{review.explanation}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function QuizGradingPanel({
  submission,
  score,
  setScore,
  feedback,
  setFeedback,
  loadingDetail,
  reviewSubmitting,
  onReview,
}) {
  const reviewed = String(submission.teacherReviewStatus || '').toUpperCase() === 'REVIEWED';
  const teacherManual = String(submission.gradingMode || '').toUpperCase() === 'TEACHER_MANUAL';
  const canShowAnswerKey = !teacherManual || reviewed;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!onReview || reviewSubmitting || reviewed) return;
    await onReview(submission.id, score, feedback);
  };

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="card-header">
        <h3>Duyệt kết quả quiz</h3>
        <div className="quiz-grading-score-summary">
          {teacherManual && submission.autoScore === null && submission.score === null ? (
            <Tag color="blue">Giảng viên chấm · Chưa có điểm</Tag>
          ) : (
            <Tag>Điểm backend: {submission.autoScore ?? submission.score} / {submission.maxScore}</Tag>
          )}
          {reviewed && (
            <Tag color="green">Điểm cuối: {submission.teacherReviewedScore ?? submission.finalScore} / {submission.maxScore}</Tag>
          )}
        </div>
      </div>
      <div className="grading-panel-body" style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
        {loadingDetail && <p className="no-data-text">Đang tải câu hỏi và bài làm...</p>}
        {!loadingDetail && submission.questions?.length === 0 && (
          <p className="no-data-text">Bài làm này chưa có chi tiết câu hỏi.</p>
        )}
        {submission.questions?.map((question, index) => (
          <QuizQuestionReview
            key={question.questionId || index}
            question={question}
            answer={submission.answers?.find((item) => item.questionId === question.questionId)}
            index={index}
            allowAnswerKey={canShowAnswerKey}
          />
        ))}
      </div>
      {reviewed ? (
        <div className="grading-panel-body quiz-final-review-summary">
          <Alert
            type="success"
            showIcon
            title="Giảng viên đã hoàn tất duyệt điểm"
            description={(
              <div>
                <p>Điểm cuối: <strong>{submission.teacherReviewedScore ?? submission.finalScore} / {submission.maxScore}</strong></p>
                {submission.teacherFeedback && <p>Nhận xét: {submission.teacherFeedback}</p>}
                {formatReviewTime(submission.teacherReviewedAt) && <p>Duyệt lúc: {formatReviewTime(submission.teacherReviewedAt)}</p>}
              </div>
            )}
          />
        </div>
      ) : (
        <div className="grading-panel-body quiz-final-review-form">
          <Alert
            type="info"
            showIcon
            title="Xác nhận điểm cuối"
            description="Backend tính điểm từ answer key đã xuất bản. Giảng viên chỉ xác nhận tổng điểm và nhận xét, không thay đổi từng lựa chọn của sinh viên."
          />
          <form className="portal-form" onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="teacher-quiz-final-score">Điểm cuối (Tối đa: {submission.maxScore})</label>
              <input
                id="teacher-quiz-final-score"
                aria-label="Điểm cuối"
                type="number"
                step="1"
                min="0"
                max={submission.maxScore}
                className="glass-input-field"
                value={score}
                onChange={(event) => setScore(event.target.value)}
                required
                disabled={reviewSubmitting}
              />
            </div>
            <div className="input-group">
              <label htmlFor="teacher-quiz-final-feedback">Nhận xét của giảng viên</label>
              <textarea
                id="teacher-quiz-final-feedback"
                aria-label="Nhận xét của giảng viên"
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                required
                placeholder="Giải thích điểm hoặc hướng dẫn sinh viên ôn tập."
                disabled={reviewSubmitting}
              />
            </div>
            <button type="submit" className="btn-submit-form" disabled={reviewSubmitting || !onReview}>
              {reviewSubmitting ? 'Đang lưu kết quả...' : 'Xác nhận điểm cuối'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
