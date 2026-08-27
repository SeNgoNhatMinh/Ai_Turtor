import { Alert, Button, Empty, Input, Tag } from 'antd';
import { Check, X } from 'lucide-react';
import { confirmAction, confirmDanger } from '../../../components/common/confirmDialog';
import { formatKnowledgeCandidateStatus } from '../../../constants/knowledgeFlow';
import KnowledgeImageGallery from './KnowledgeImageGallery';

const CANDIDATE_TYPE_LABELS = {
  ACADEMIC_KNOWLEDGE: 'Kiến thức học thuật',
  MATERIAL_CORRECTION: 'Sửa nội dung tài liệu',
  FAQ_CLARIFICATION: 'Làm rõ câu hỏi thường gặp',
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('vi-VN');
};

function KnowledgeCandidateReviewList({
  candidates = [],
  candidateNotes = {},
  canReviewKnowledgeCandidates = false,
  handleNoteChange,
  handleApproveCandidate,
  handleRejectCandidate,
  pendingActionIds = [],
  currentReviewerId = '',
  history = false,
}) {
  if (candidates.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="Không có tri thức nào đang chờ phê duyệt."
      />
    );
  }

  return <div className="knowledge-candidate-list">{candidates.map((cand) => {
    const note = candidateNotes[cand.id] || '';
    const isPending = pendingActionIds.includes(cand.id);
    const candidateAuthorId = cand.teacherId || cand.createdBy || cand.authorId || '';
    const isOwnCandidate = Boolean(
      currentReviewerId
      && candidateAuthorId
      && String(currentReviewerId) === String(candidateAuthorId),
    );
    const isActionDisabled = !String(note).trim() || isPending || isOwnCandidate;
    const normalizedStatus = String(cand.status || '').trim().toUpperCase();
    const isIndexed = ['INDEXED', 'APPROVED', 'APPROVED_INTO_AI_KNOWLEDGE'].includes(normalizedStatus);

    const existing = cand.existingAcademicKnowledge;
    const approveContent = existing
      ? `Câu hỏi này đã có trong RAG. Phê duyệt sẽ thay thế đáp án cũ bằng nội dung này; AI chỉ dùng đáp án mới.`
      : 'Nội dung sẽ được đưa vào RAG và có thể được AI Tutor sử dụng để trả lời.';

    const submitDecision = async (decision) => {
      const handler = decision === 'APPROVE' ? handleApproveCandidate : handleRejectCandidate;
      const succeeded = await handler?.(cand.id, note);
      if (succeeded) handleNoteChange?.(cand.id, '');
    };

    const requestDecision = (event, decision) => {
      const approving = decision === 'APPROVE';
      const openConfirm = approving ? confirmAction : confirmDanger;
      openConfirm({
        title: approving ? 'Phê duyệt tri thức này?' : 'Từ chối tri thức này?',
        content: approving
          ? approveContent
          : 'Candidate sẽ bị từ chối, không được đưa vào RAG. Lý do từ chối sẽ được lưu lại.',
        okText: approving ? 'Phê duyệt' : 'Từ chối',
        cancelText: 'Hủy',
        anchorRect: event.currentTarget.getBoundingClientRect(),
        onOk: () => submitDecision(decision),
      });
    };

    return (
      <article key={cand.id} className="candidate-card-item">
        <header className="candidate-card-item__header">
          <div className="candidate-card-item__tags">
            <Tag color={history ? (isIndexed ? 'green' : 'red') : 'gold'}>
              {formatKnowledgeCandidateStatus(cand.status)}
            </Tag>
            <Tag>{cand.courseId || 'Tri thức môn học'}</Tag>
            {cand.candidateType && (
              <Tag>{CANDIDATE_TYPE_LABELS[cand.candidateType] || cand.candidateType}</Tag>
            )}
          </div>
          {(cand.teacherName || cand.createdByName || cand.authorName) && (
            <span className="candidate-card-item__author">
              Đề xuất bởi {cand.teacherName || cand.createdByName || cand.authorName}
            </span>
          )}
        </header>
        <div className="compare-box">
          <div className="compare-qa">
            <span>Câu hỏi</span>
            <p>{cand.question || '—'}</p>
          </div>
          <div className="compare-qa teacher-a">
            <span>Tri thức đề xuất</span>
            <p>{cand.answer || cand.content || '—'}</p>
            <KnowledgeImageGallery images={cand.images} />
          </div>
        </div>

        {history ? (
          <div className="candidate-history-meta">
            <div>
              <span>Người kiểm duyệt</span>
              <strong>{cand.reviewerName || 'Senior Mentor / Admin'}</strong>
            </div>
            <div>
              <span>Thời gian</span>
              <strong>{formatDate(cand.reviewedAt || cand.updatedAt || cand.indexedAt) || 'Backend chưa cung cấp'}</strong>
            </div>
            <div className="candidate-history-meta__note">
              <span>{isIndexed ? 'Ghi chú phê duyệt' : 'Lý do từ chối'}</span>
              <strong>{cand.rejectionReason || cand.reviewNote || 'Không có ghi chú.'}</strong>
            </div>
          </div>
        ) : canReviewKnowledgeCandidates ? (
          <>
            {existing && (
              <Alert
                type="warning"
                showIcon
                title="Câu hỏi này đã có trong RAG"
                description="Phê duyệt sẽ thay thế đáp án đang nạp. AI sẽ chỉ dùng đáp án mới, không giữ hai đáp án cùng lúc."
              />
            )}
            {isOwnCandidate && (
              <Alert
                type="info"
                showIcon
                title="Cần người kiểm duyệt độc lập"
                description="Bạn là người tạo đề xuất này. Senior Mentor khác hoặc Admin phải đưa ra quyết định."
              />
            )}
            <div className="candidate-card-item__review">
              <label htmlFor={`candidate-note-${cand.id}`}>Ghi chú kiểm duyệt</label>
              <Input.TextArea
                id={`candidate-note-${cand.id}`}
                rows={3}
                maxLength={2000}
                showCount
                placeholder={isOwnCandidate
                  ? 'Chờ người kiểm duyệt độc lập...'
                  : 'Nêu căn cứ phê duyệt hoặc nội dung cần chỉnh sửa...'}
                value={note}
                disabled={isOwnCandidate || isPending}
                onChange={(event) => handleNoteChange?.(cand.id, event.target.value)}
              />
            </div>

            <div className="candidate-actions">
              <Button
                type="primary"
                icon={<Check size={15} />}
                disabled={isActionDisabled}
                loading={isPending}
                onClick={(event) => requestDecision(event, 'APPROVE')}
              >
                Phê duyệt vào tri thức AI
              </Button>
              <Button
                danger
                icon={<X size={15} />}
                disabled={isActionDisabled}
                loading={isPending}
                onClick={(event) => requestDecision(event, 'REJECT')}
              >
                Từ chối
              </Button>
            </div>
          </>
        ) : (
          <Alert
            type="info"
            showIcon
            title="Chỉ Senior Mentor hoặc Admin được phê duyệt"
          />
        )}
      </article>
    );
  })}</div>;
}

export default KnowledgeCandidateReviewList;
