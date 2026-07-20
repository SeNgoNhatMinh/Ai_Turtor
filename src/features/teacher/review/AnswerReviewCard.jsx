import { Alert, Button, Input, Rate, Select, Tag } from 'antd';
import {
  formatAnswerReviewStatus,
  formatAnswerReviewType,
} from '../../../constants/answerReview';
import { getPersonDisplayName } from '../../../utils/displayNames';

const CANDIDATE_TYPES = [
  { value: 'ACADEMIC_KNOWLEDGE', label: 'Academic knowledge' },
  { value: 'MATERIAL_CORRECTION', label: 'Material correction' },
  { value: 'FAQ_CLARIFICATION', label: 'FAQ clarification' },
];

const formatBoolean = (value) => {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return 'Not provided';
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
      <p>{value || 'Not provided'}</p>
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
  const notes = String(draft.notes || '');
  const correctedAnswer = String(draft.correctedAnswer || '');
  const candidateType = draft.candidateType || 'ACADEMIC_KNOWLEDGE';
  const studentLabel = getPersonDisplayName(review, 'Student');
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
            {[review.courseId && `Course ${review.courseId}`, review.classId && `Class ${review.classId}`, createdAt]
              .filter(Boolean)
              .join(' · ') || 'Course context unavailable'}
          </p>
        </div>
        <div className="answer-review-card__rating" aria-label={`Rating ${review.rating || 0} out of 5`}>
          <Rate disabled value={review.rating || 0} count={5} />
          <span>{review.rating ? `${review.rating}/5` : 'No rating'}</span>
        </div>
      </header>

      <div className="answer-review-facts">
        <span>Accurate: <strong>{formatBoolean(review.accurate)}</strong></span>
        <span>Helpful: <strong>{formatBoolean(review.helpful)}</strong></span>
        {review.mode && <span>Mode: <strong>{review.mode}</strong></span>}
      </div>

      <div className="answer-review-evidence">
        <ReviewTextBlock label="Student question" value={review.question} />
        <ReviewTextBlock label="Previous AI answer" value={review.answer} tone="answer" />
        <ReviewTextBlock label="Student feedback" value={review.feedback} tone="feedback" />
        {review.suggestedCorrection && (
          <ReviewTextBlock label="Suggested correction" value={review.suggestedCorrection} tone="correction" />
        )}
      </div>

      {isSeniorQueue ? (
        <div className="answer-review-resolution">
          <Input.TextArea
            rows={2}
            value={notes}
            maxLength={2000}
            disabled={isPending || !onDraftChange}
            placeholder="Required review note..."
            onChange={(event) => onDraftChange?.({ notes: event.target.value })}
          />
          <Input.TextArea
            rows={4}
            value={correctedAnswer}
            maxLength={10000}
            disabled={isPending || !onDraftChange}
            placeholder="Correct academic answer (required only when creating reusable AI knowledge)..."
            onChange={(event) => onDraftChange?.({ correctedAnswer: event.target.value })}
          />
          <Select
            value={candidateType}
            options={CANDIDATE_TYPES}
            disabled={isPending || !onDraftChange}
            aria-label="Knowledge candidate type"
            onChange={(value) => onDraftChange?.({ candidateType: value })}
          />
          <div className="answer-review-resolution__actions">
            <Button
              disabled={!notes.trim() || isPending || !onResolve}
              loading={isPending}
              onClick={() => onResolve?.('APPROVE_FEEDBACK')}
            >
              Resolve without AI update
            </Button>
            <Button
              type="primary"
              disabled={!notes.trim() || !correctedAnswer.trim() || isPending || !onResolve}
              loading={isPending}
              onClick={() => onResolve?.('CREATE_KNOWLEDGE_CANDIDATE')}
            >
              Create knowledge candidate
            </Button>
          </div>
          <p className="answer-review-resolution__hint">
            Creating a candidate does not update AI yet. Senior/Admin approval is still required below.
          </p>
        </div>
      ) : (
        <Alert
          type="warning"
          showIcon
          title="Teacher verification required"
          description="The backend currently exposes this teacher queue as read-only. A mentor-resolution endpoint is required to persist a correction and remove the ticket from this queue."
        />
      )}
    </article>
  );
}
