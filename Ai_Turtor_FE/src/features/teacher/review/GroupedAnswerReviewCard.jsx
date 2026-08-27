import { Alert, Button, Collapse, Input, Rate, Tag } from 'antd';
import {
  formatAnswerReviewStatus,
  formatEscalationTier,
} from '../../../constants/answerReview';
import { REVIEW_NOTE_MAX_LENGTH } from '../../../constants/knowledgeAnswer';
import KnowledgeAnswerComposer from './KnowledgeAnswerComposer';

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
  const images = Array.isArray(draft.images) ? draft.images : [];
  const tierColor = group.escalationTier === 'SEVERE' || group.escalationTier === 'IMMEDIATE'
    ? 'red'
    : 'gold';
  const composerId = `senior-knowledge-answer-${group.representativeReviewId || group.id}`;

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
            sinh viên phản hồi
            {group.similarQuestionCount > 1 ? ` · ${group.similarQuestionCount} câu hỏi tương tự` : ' về cùng chủ đề'}
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
          <span>{group.reviewCount} lượt đánh giá tệ</span>
          <span>{group.distinctStudentCount} sinh viên</span>
        </div>
      </header>

      <div className={isSeniorQueue ? 'grouped-answer-review__body' : undefined}>
        <div className="grouped-answer-review__context">
          <section className="answer-review-evidence">
            <div className="answer-review-text answer-review-text--default">
              <span>Câu hỏi</span>
              <p>{group.question || '—'}</p>
              {group.similarQuestions?.length > 0 && (
                <ul className="grouped-answer-review__similar">
                  {group.similarQuestions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              )}
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
        </div>

        {isSeniorQueue ? (
          <div className="grouped-answer-review__composer">
            <header className="grouped-answer-review__composer-head">
              <span>Soạn tri thức đúng</span>
              <h5>Viết câu trả lời học thuật để bổ sung RAG</h5>
              <p>
                Câu hỏi đã hiện bên trái. Ô dưới dành cho nội dung đúng, đủ dài, kèm sơ đồ nếu cần.
                Đóng phản hồi nếu không cần cập nhật tri thức.
              </p>
            </header>
            <label className="grouped-answer-review__note-label" htmlFor={`${composerId}-notes`}>
              Ghi chú kiểm duyệt
            </label>
            <Input.TextArea
              id={`${composerId}-notes`}
              rows={2}
              value={notes}
              maxLength={REVIEW_NOTE_MAX_LENGTH}
              showCount
              disabled={isPending || !onDraftChange}
              placeholder="Ví dụ: đã đối chiếu giáo trình chương Servlet, AI trả lời lệch sang Code Mentor..."
              onChange={(event) => onDraftChange?.({ notes: event.target.value })}
            />
            <KnowledgeAnswerComposer
              id={composerId}
              label="Câu trả lời học thuật đúng"
              required
              value={correctedAnswer}
              images={images}
              disabled={isPending || !onDraftChange}
              placeholder="Câu trả lời học thuật đúng (bắt buộc khi tạo tri thức dùng lại). Có thể dán hoặc tải hình minh họa..."
              onChange={(nextValue) => onDraftChange?.({ correctedAnswer: nextValue })}
              onImagesChange={(nextImages) => onDraftChange?.({ images: nextImages })}
            />
            <p className="answer-review-resolution__hint">
              Loại đề xuất được cố định là kiến thức học thuật.
            </p>
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
              Đề xuất tri thức chưa đưa vào RAG ngay. Senior khác hoặc Admin vẫn cần phê duyệt ở bước Tri thức chờ duyệt.
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
      </div>
    </article>
  );
}
