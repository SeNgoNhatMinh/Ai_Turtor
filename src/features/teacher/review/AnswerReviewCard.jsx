import { Alert, Button, Input, Rate, Select, Tag } from 'antd';
import {
  formatAnswerReviewStatus,
  formatAnswerReviewType,
} from '../../../constants/answerReview';
import { getPersonDisplayName } from '../../../utils/displayNames';

const CANDIDATE_TYPES = [
  { value: 'ACADEMIC_KNOWLEDGE', label: 'Kiến thức học thuật' },
  { value: 'MATERIAL_CORRECTION', label: 'Sửa nội dung tài liệu' },
  { value: 'FAQ_CLARIFICATION', label: 'Làm rõ câu hỏi thường gặp' },
];

const formatBoolean = (value) => {
  if (value === true) return 'Có';
  if (value === false) return 'Không';
  return 'Chưa cung cấp';
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
};

function ReviewTextBlock({ label, value, tone = 'default' }) {
  return (
    <section className={`answer-review-text answer-review-text--${tone}`}>
      <span>{label}</span>
      <p>{value || 'Chưa cung cấp'}</p>
    </section>
  );
}

export default function AnswerReviewCard({
  review,
  queue = 'mentor',
  draft = {},
  isPending = false,
  onDraftChange,
  onResolve,
}) {
  const isSeniorQueue = queue === 'senior';
  const isHistory = queue === 'history';
  const notes = String(draft.notes || '');
  const correctedAnswer = String(draft.correctedAnswer || '');
  const candidateType = draft.candidateType || 'ACADEMIC_KNOWLEDGE';
  const studentLabel = getPersonDisplayName(review, 'Sinh viên');
  const createdAt = formatDate(review.createdAt);

  return (
    <article className="answer-review-card">
      <header className="answer-review-card__header">
        <div>
          <div className="answer-review-card__tags">
            <Tag color={isSeniorQueue ? 'red' : 'gold'}>{formatAnswerReviewStatus(review.status)}</Tag>
            <Tag>{formatAnswerReviewType(review.reviewType)}</Tag>
          </div>
          <h4>{studentLabel}</h4>
          <p>
            {[review.courseId && `Môn ${review.courseId}`, review.classId && `Lớp ${review.classId}`, createdAt]
              .filter(Boolean)
              .join(' · ') || 'Không có ngữ cảnh môn học'}
          </p>
        </div>
        <div className="answer-review-card__rating" aria-label={`Đánh giá ${review.rating || 0} trên 5`}>
          <Rate disabled value={review.rating || 0} count={5} />
          <span>{review.rating ? `${review.rating}/5` : 'Chưa đánh giá'}</span>
        </div>
      </header>

      <div className="answer-review-facts">
        <span>Chính xác: <strong>{formatBoolean(review.accurate)}</strong></span>
        <span>Hữu ích: <strong>{formatBoolean(review.helpful)}</strong></span>
        {review.mode && <span>Chế độ: <strong>{review.mode}</strong></span>}
      </div>

      <div className="answer-review-evidence">
        <ReviewTextBlock label="Câu hỏi của sinh viên" value={review.question} />
        <ReviewTextBlock label="Câu trả lời AI trước đó" value={review.answer} tone="answer" />
        <ReviewTextBlock label="Phản hồi của sinh viên" value={review.feedback} tone="feedback" />
        {review.suggestedCorrection && (
          <ReviewTextBlock label="Nội dung sửa được đề xuất" value={review.suggestedCorrection} tone="correction" />
        )}
      </div>

      {isHistory ? (
        <Alert
          type="success"
          showIcon
          title="Phản hồi đã được xử lý"
          description={(
            <div className="answer-review-history-detail">
              {review.correctedAnswer && <ReviewTextBlock label="Câu trả lời đã hiệu chỉnh" value={review.correctedAnswer} tone="correction" />}
              <span>
                {[review.resolvedByName && `Người xử lý: ${review.resolvedByName}`, review.resolvedAt && `Thời gian: ${formatDate(review.resolvedAt)}`]
                  .filter(Boolean)
                  .join(' · ') || 'Backend đã ghi nhận kết quả xử lý.'}
              </span>
              {review.resolutionNote && <span>Ghi chú: {review.resolutionNote}</span>}
              {review.linkedKnowledgeCandidateId && <Tag color="purple">Có Knowledge Candidate liên kết</Tag>}
            </div>
          )}
        />
      ) : isSeniorQueue ? (
        <div className="answer-review-resolution">
          <Input.TextArea
            rows={2}
            value={notes}
            maxLength={2000}
            disabled={isPending || !onDraftChange}
            placeholder="Ghi chú kiểm tra (bắt buộc)..."
            onChange={(event) => onDraftChange?.({ notes: event.target.value })}
          />
          <Input.TextArea
            rows={4}
            value={correctedAnswer}
            maxLength={10000}
            disabled={isPending || !onDraftChange}
            placeholder="Câu trả lời học thuật đúng (bắt buộc khi tạo tri thức dùng lại)..."
            onChange={(event) => onDraftChange?.({ correctedAnswer: event.target.value })}
          />
          <Select
            value={candidateType}
            options={CANDIDATE_TYPES}
            disabled={isPending || !onDraftChange}
            aria-label="Loại Knowledge Candidate"
            onChange={(value) => onDraftChange?.({ candidateType: value })}
          />
          <div className="answer-review-resolution__actions">
            <Button
              disabled={!notes.trim() || isPending || !onResolve}
              loading={isPending}
              onClick={() => onResolve?.('APPROVE_FEEDBACK')}
            >
              Xử lý, không cập nhật AI
            </Button>
            <Button
              type="primary"
              disabled={!notes.trim() || !correctedAnswer.trim() || isPending || !onResolve}
              loading={isPending}
              onClick={() => onResolve?.('CREATE_KNOWLEDGE_CANDIDATE')}
            >
              Tạo Knowledge Candidate
            </Button>
          </div>
          <p className="answer-review-resolution__hint">
            Tạo candidate chưa làm AI học ngay. Vẫn cần Senior Mentor hoặc Admin phê duyệt.
          </p>
        </div>
      ) : (
        <Alert
          type="warning"
          showIcon
          title="Cần giảng viên xác minh"
          description="Backend hiện chỉ cho đọc hàng chờ này. Cần endpoint mentor-resolution để lưu nội dung sửa và hoàn tất phản hồi."
        />
      )}
    </article>
  );
}
