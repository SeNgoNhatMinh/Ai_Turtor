import { formatKnowledgeCandidateStatus } from '../../../constants/knowledgeFlow';

function KnowledgeCandidateReviewList({
  candidates = [],
  candidateNotes = {},
  canReviewKnowledgeCandidates = false,
  handleNoteChange,
  handleApproveCandidate,
  handleRejectCandidate,
  pendingActionIds = [],
  currentReviewerId = '',
}) {
  if (candidates.length === 0) {
    return <div className="no-data-text">Không có tri thức đề xuất đang chờ phê duyệt.</div>;
  }

  return candidates.map((cand) => {
    const note = candidateNotes[cand.id] || '';
    const isPending = pendingActionIds.includes(cand.id);
    const candidateAuthorId = cand.teacherId || cand.createdBy || cand.authorId || '';
    const isOwnCandidate = Boolean(
      currentReviewerId
      && candidateAuthorId
      && String(currentReviewerId) === String(candidateAuthorId),
    );
    const isActionDisabled = !String(note).trim() || isPending || isOwnCandidate;

    return (
      <div key={cand.id} className="candidate-card-item">
        <span className="badge-cand">
          {formatKnowledgeCandidateStatus(cand.status)} · {cand.courseId || 'Tri thức môn học'}
        </span>
        <div className="compare-box">
          <div className="compare-qa"><strong>Câu hỏi:</strong> {cand.question || '-'}</div>
          <div className="compare-qa teacher-a"><strong>Câu trả lời đề xuất:</strong> {cand.content || cand.answer || '-'}</div>
        </div>

        {canReviewKnowledgeCandidates ? (
          <>
            {isOwnCandidate && (
              <div className="no-data-text" style={{ textAlign: 'left', marginTop: 10 }}>
                Bạn đã tạo Candidate này ở Flow 3.5. Một Senior Mentor khác hoặc Admin phải thực hiện Flow 4.
              </div>
            )}
            <div style={{ marginTop: 10, marginBottom: 10 }}>
              <input
                type="text"
                placeholder={isOwnCandidate
                  ? 'Chờ người kiểm duyệt độc lập...'
                  : 'Ghi chú phê duyệt hoặc lý do từ chối (bắt buộc)...'}
                value={note}
                disabled={isOwnCandidate}
                onChange={(e) => handleNoteChange(cand.id, e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid #d9d9d9',
                  fontSize: 12,
                }}
              />
            </div>

            <div className="candidate-actions">
              <button
                type="button"
                className="btn-approve-cand"
                disabled={isActionDisabled}
                onClick={async () => {
                  const succeeded = await handleApproveCandidate(cand.id, note);
                  if (succeeded) handleNoteChange(cand.id, '');
                }}
              >
                {isPending ? 'Đang xử lý...' : 'Phê duyệt vào tri thức AI'}
              </button>
              <button
                type="button"
                className="btn-reject-cand"
                disabled={isActionDisabled}
                onClick={async () => {
                  const succeeded = await handleRejectCandidate(cand.id, note);
                  if (succeeded) handleNoteChange(cand.id, '');
                }}
              >
                {isPending ? 'Đang xử lý...' : 'Yêu cầu chỉnh sửa'}
              </button>
            </div>
          </>
        ) : (
          <div className="no-data-text" style={{ textAlign: 'left' }}>
            Bạn có thể xem nội dung này, nhưng chỉ Admin hoặc Senior Mentor được phép phê duyệt vào tri thức AI.
          </div>
        )}
      </div>
    );
  });
}

export default KnowledgeCandidateReviewList;
