import { Alert, Button, Collapse, Input, Rate, Select, Tag } from 'antd';
import {
  formatAnswerReviewStatus,
  formatEscalationTier,
} from '../../../constants/answerReview';

const CANDIDATE_TYPES = [
  { value: 'ACADEMIC_KNOWLEDGE', label: 'Kiến thức học thuật' },
  { value: 'MATERIAL_CORRECTION', label: 'Sửa nội dung tài liệu' },
  { value: 'FAQ_CLARIFICATION', label: 'Làm rõ câu hỏi thường gặp' },
];

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
};

function EvidenceRow({ item }) {
  return (
    <div className="grouped-answer-review__evidence-row">
      <div className="grouped-answer-review__evidence-meta">
        <strong>{item.studentName || item.studentEmail || 'Sinh viên phản hồi'}</strong>
        <Rate disabled value={item.rating || 0} count={5} />
        <span>{item.createdAt ? formatDate(item.createdAt) : ''}</span>
      </div>
      <p>{item.feedback || 'Không có mô tả chi tiết.'}</p>
    </div>
  );
}

export default function GroupedAnswerReviewCard({
  group,
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
  const tierColor = group.escalationTier === 'SEVERE' || group.escalationTier === 'IMMEDIATE'
    ? 'red'
    : 'gold';

  return (
    <article className="answer-review-card grouped-answer-review">
      <header className="answer-review-card__header grouped-answer-review__header">
        <div>
          <div className="answer-review-card__tags">
            <Tag color={tierColor}>{formatEscalationTier(group.escalationTier)}</Tag>
            <Tag>{formatAnswerReviewStatus(group.queueStatus || group.status)}</Tag>
          </div>
          <h4>
            {group.distinctStudentCount}
            {' '}
            sinh viên phản hồi về cùng câu trả lời AI
          </h4>
          <p>
            {[
              group.courseId && `Môn ${group.courseId}`,
              group.classId && `Lớp ${group.classId}`,
              group.averageRating != null && `TB ${group.averageRating.toFixed(1)}/5`,
              group.lastReportedAt && `Cập nhật ${formatDate(group.lastReportedAt)}`,
            ].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="grouped-answer-review__stats" aria-label="Thống kê nhóm phản hồi">
          <span>{group.reviewCount} lượt góp ý</span>
          <span>{group.distinctStudentCount} sinh viên</span>
        </div>
      </header>

      <section className="answer-review-evidence">
        <div className="answer-review-text answer-review-text--default">
          <span>Câu hỏi</span>
          <p>{group.question || '—'}</p>
        </div>
        <div className="answer-review-text answer-review-text--answer">
          <span>Câu trả lời AI (cùng nội dung được gom)</span>
          <p>{group.answer || '—'}</p>
        </div>
      </section>

      <Collapse
        bordered={false}
        className="grouped-answer-review__collapse"
        items={[
          {
            key: 'evidence',
            label: `Chi tiết theo sinh viên (${group.evidence?.length || 0})`,
            children: (group.evidence || []).map((item) => (
              <EvidenceRow key={item.reviewId || `${item.studentId}-${item.createdAt}`} item={item} />
            )),
          },
        ]}
      />

      {isSeniorQueue ? (
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
              Đóng phản hồi
            </Button>
            <Button
              type="primary"
              disabled={!notes.trim() || !correctedAnswer.trim() || isPending || !onResolve}
              loading={isPending}
              onClick={() => onResolve?.('CREATE_KNOWLEDGE_CANDIDATE')}
            >
              Đề xuất tri thức đúng
            </Button>
          </div>
          <p className="answer-review-resolution__hint">
            Đóng phản hồi nếu không cần cập nhật tri thức. Nếu câu trả lời AI sai, hãy đề xuất nội dung đúng để một người khác phê duyệt trước khi đưa vào RAG.
          </p>
        </div>
      ) : (
        <Alert
          type="info"
          showIcon
          title="Giảng viên xác minh trước khi leo thang kiến thức"
          description="Nhóm này chỉ xuất hiện khi đủ số sinh viên độc lập đánh giá tiêu cực (2–3 sao) về cùng câu trả lời AI. Teacher xác minh ở Flow 3; nếu cần cập nhật tri thức, Senior tạo Candidate ở Flow 3.5 và duyệt index riêng tại Flow 4."
        />
      )}
    </article>
  );
}
