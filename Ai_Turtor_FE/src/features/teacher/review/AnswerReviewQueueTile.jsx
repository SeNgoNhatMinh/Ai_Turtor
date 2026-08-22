import { Tag } from 'antd';
import { AlertTriangle, MessageSquareWarning, Users } from 'lucide-react';
import { formatEscalationTier } from '../../../constants/answerReview';

function queueAlert(group) {
  if (group?.redAlert || String(group?.alertLevel || '').toUpperCase() === 'RED') {
    return 'red';
  }
  const negativeCount = Number(group?.negativeReviewCount ?? group?.reviewCount) || 0;
  const studentCount = Number(group?.distinctStudentCount) || 0;
  if (negativeCount <= 1 && studentCount <= 1) return 'watch';
  return 'attention';
}

const ALERT_COPY = {
  red: 'Nhiều đánh giá tệ — cần xử lý',
  attention: 'Đang tích lượt góp ý',
  watch: 'Mới 1 góp ý — chưa cần xử lý',
};

export function queueItemKey(group) {
  return group?.answerFingerprint || group?.representativeReviewId || group?.id || '';
}

export default function AnswerReviewQueueTile({ group, onOpen }) {
  const alert = queueAlert(group);
  const reviewCount = Number(group?.reviewCount) || 0;
  const studentCount = Number(group?.distinctStudentCount) || 0;
  const similarCount = Number(group?.similarQuestionCount) || 0;

  return (
    <button
      type="button"
      className={`answer-review-tile answer-review-tile--${alert}`}
      onClick={() => onOpen?.(group)}
    >
      <div className="answer-review-tile__tags">
        <Tag color={alert === 'red' ? 'red' : alert === 'attention' ? 'gold' : 'default'}>
          {ALERT_COPY[alert]}
        </Tag>
        <Tag>{formatEscalationTier(group.escalationTier)}</Tag>
      </div>
      <h4>{group.question || 'Câu hỏi chưa có nội dung'}</h4>
      <p>
        {[
          group.courseId && `Môn ${group.courseId}`,
          group.classId && `Lớp ${group.classId}`,
          similarCount > 1 && `${similarCount} câu hỏi tương tự`,
        ].filter(Boolean).join(' · ')}
      </p>
      <div className="answer-review-tile__stats">
        <span><MessageSquareWarning size={14} /> {reviewCount} lượt đánh giá tệ</span>
        <span><Users size={14} /> {studentCount} sinh viên</span>
        {alert === 'red' && (
          <span className="answer-review-tile__urgent"><AlertTriangle size={14} /> Ưu tiên</span>
        )}
      </div>
      <small className="answer-review-tile__cta">Xem chi tiết</small>
    </button>
  );
}
