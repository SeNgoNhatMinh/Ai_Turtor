import { memo } from 'react';
import { Tag } from 'antd';
import {
  formatQuizDateTime,
  getAssignmentId,
  getQuizId,
  getQuizQuestionCount,
  getQuizScoreText,
  getQuizStatusColor,
  getQuizStatusLabel,
} from './practiceQuizUtils';

function QuizItemCard({ item, action }) {
  const questionCount = getQuizQuestionCount(item);
  return (
    <div className="quiz-item-card" data-quiz-id={getQuizId(item) || getAssignmentId(item)}>
      <div className="quiz-item-main">
        <div className="quiz-item-title-row">
          <strong>{item.title || item.topic || 'Practice quiz'}</strong>
          <Tag color={getQuizStatusColor(item.status)}>{getQuizStatusLabel(item)}</Tag>
        </div>
        <div className="quiz-item-meta">
          {item.quizType && <span>{item.quizType}</span>}
          {item.classId && <span>Class {item.classId}</span>}
          {questionCount && <span>{questionCount} questions</span>}
          <span>{getQuizScoreText(item)}</span>
          <span>{formatQuizDateTime(item.updatedAt || item.submittedAt || item.createdAt || item.publishedAt)}</span>
        </div>
      </div>
      <div className="quiz-item-action">{action}</div>
    </div>
  );
}

export default memo(QuizItemCard);
