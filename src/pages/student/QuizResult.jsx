import { Button, Card, Progress, Space, Tag, Typography } from 'antd';
import { CheckCircleFilled, CloseCircleFilled, RetweetOutlined } from '@ant-design/icons';
import AiAnswer from '../../components/AiAnswer';
import {
  getAnswerForQuestion,
  getQuestionId,
  getQuestionText,
  getQuizReviewDetails,
} from '../../features/student/quizzes/quizQuestionUtils';

const { Text, Title } = Typography;

const normalizeStatus = (status) => String(status || '').toUpperCase();

const getStatusLabel = (result) => {
  const reviewStatus = normalizeStatus(result?.teacherReviewStatus || result?.reviewStatus);
  if (reviewStatus.includes('REVIEWED')) return 'Giảng viên đã duyệt';
  if (result?.quizType === 'ASSIGNED' && normalizeStatus(result?.status) === 'SUBMITTED') return 'Chờ giảng viên duyệt';
  if (normalizeStatus(result?.status) === 'SUBMITTED') return 'Backend đã chấm';
  return result?.status || 'Đã tạo';
};

function QuizResult({ result, onRetry, retryLoading = false }) {
  if (!result) return null;

  const score = Number(result.teacherReviewedScore ?? result.score ?? result.autoScore ?? 0);
  const maxScore = Number(result.maxScore ?? result.totalScore ?? result.questions?.length ?? 0);
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const questions = Array.isArray(result.questions) ? result.questions : [];
  const status = getStatusLabel(result);
  const resultStatus = normalizeStatus(result.status);
  const reviewStatus = normalizeStatus(result.teacherReviewStatus || result.reviewStatus);
  const gradingMode = normalizeStatus(result.gradingMode);
  const isTeacherOnlineQuiz = gradingMode === 'TEACHER_MANUAL' || gradingMode === 'AI_ASSISTED';
  const isTeacherReviewed = reviewStatus === 'REVIEWED';
  const canRevealAnswers = ['SUBMITTED', 'COMPLETED', 'REVIEWED'].includes(resultStatus)
    || reviewStatus.includes('REVIEWED');
  const canRevealAnswerKey = canRevealAnswers && (!isTeacherOnlineQuiz || isTeacherReviewed);
  const hasScore = result.score !== null && result.score !== undefined
    || result.teacherReviewedScore !== null && result.teacherReviewedScore !== undefined
    || result.autoScore !== null && result.autoScore !== undefined;

  return (
    <Card className="quiz-card quiz-result-card">
      <Space orientation="vertical" size={14} style={{ width: '100%' }}>
        <div className="quiz-result-header">
          <div>
            <Title level={4} style={{ margin: 0 }}>Kết quả quiz</Title>
            <Text type="secondary">{result.topic || result.title || 'Quiz luyện tập'}</Text>
          </div>
          <Space wrap>
            <Tag color={percent >= 70 ? 'success' : percent >= 45 ? 'warning' : 'error'}>{status}</Tag>
            {result.quizType && <Tag>{result.quizType}</Tag>}
          </Space>
        </div>

        <div className="quiz-score-panel">
          <Progress percent={percent} strokeColor={percent >= 70 ? '#16A34A' : percent >= 45 ? '#F59E0B' : '#EF4444'} />
          <Text strong>
            {isTeacherOnlineQuiz && !isTeacherReviewed && !hasScore
              ? 'Điểm đang chờ giảng viên duyệt'
              : `Điểm: ${score}/${maxScore}`}
          </Text>
          {isTeacherOnlineQuiz && !isTeacherReviewed && (
            <Text type="secondary">
              {gradingMode === 'TEACHER_MANUAL'
                ? 'Giảng viên sẽ nhập điểm cuối cùng sau khi xem bài.'
                : 'Điểm backend tính chỉ là gợi ý cho đến khi giảng viên xác nhận.'}
            </Text>
          )}
          {result.teacherFeedback && <Text>{result.teacherFeedback}</Text>}
          {result.feedback && !result.teacherFeedback && <Text>{result.feedback}</Text>}
          {Array.isArray(result.weakTopics) && result.weakTopics.length > 0 && (
            <div>
              <Text type="secondary">Nên ôn tiếp: </Text>
              {result.weakTopics.map((topic) => <Tag key={topic}>{topic}</Tag>)}
            </div>
          )}
          {onRetry && (
            <Button icon={<RetweetOutlined />} loading={retryLoading} onClick={onRetry}>
              Tạo lại quiz từ chủ đề này
            </Button>
          )}
        </div>

        {canRevealAnswers && questions.length > 0 && (
          <div className="quiz-result-questions">
            <Title level={5}>Xem chi tiết bài làm</Title>
            <div className="quiz-review-list">
              {questions.map((question, index) => {
                const answer = getAnswerForQuestion(result.answers, question, index);
                const review = getQuizReviewDetails(question, answer);

                return (
                  <div key={getQuestionId(question, index)} className="quiz-review-item">
                    <div className="quiz-review-question-heading">
                      <div className="quiz-review-question">
                        <Text strong>Q{index + 1}. </Text>
                        <AiAnswer markdown={getQuestionText(question, index)} />
                      </div>
                      {canRevealAnswerKey && (
                        <Tag
                          icon={review.isCorrect ? <CheckCircleFilled /> : <CloseCircleFilled />}
                          color={review.isCorrect ? 'success' : 'error'}
                        >
                          {review.isCorrect ? 'Đúng' : 'Sai'}
                        </Tag>
                      )}
                    </div>

                    <div className="quiz-review-answer-grid">
                      <Text className="quiz-review-options-label" strong>Các lựa chọn</Text>
                      <ul className="quiz-review-options" aria-label={`Các lựa chọn của câu ${index + 1}`}>
                        {review.choices.map((choice, choiceIndex) => {
                          const optionClass = canRevealAnswerKey && choice.isCorrectAnswer
                            ? 'quiz-review-option--correct'
                            : canRevealAnswerKey && choice.isSelected
                              ? 'quiz-review-option--incorrect'
                              : '';
                          return (
                            <li
                              key={`${getQuestionId(question, index)}-${choice.value || choiceIndex}`}
                              className={`quiz-review-option ${optionClass}`.trim()}
                            >
                              <span className="quiz-review-option-marker" aria-hidden="true">
                                {String.fromCharCode(65 + choiceIndex)}
                              </span>
                              <span className="quiz-review-option-text">{choice.text || choice.value}</span>
                              <span className="quiz-review-option-tags">
                                {choice.isSelected && <Tag color={canRevealAnswerKey ? (review.isCorrect ? 'success' : 'error') : 'blue'}>Bạn đã chọn</Tag>}
                                {canRevealAnswerKey && choice.isCorrectAnswer && <Tag color="success">Đáp án đúng</Tag>}
                              </span>
                            </li>
                          );
                        })}
                      </ul>

                      {!review.selectedAnswer && (
                        <Text type="danger" className="quiz-review-unanswered">Bạn chưa trả lời câu này.</Text>
                      )}

                      {canRevealAnswerKey && review.explanation && (
                        <div className="quiz-review-explanation">
                          <Text strong type="secondary">Giải thích</Text>
                          <AiAnswer markdown={review.explanation} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Space>
    </Card>
  );
}

export default QuizResult;
