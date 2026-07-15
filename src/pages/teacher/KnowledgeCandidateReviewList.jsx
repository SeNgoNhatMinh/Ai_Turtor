import { formatKnowledgeCandidateStatus } from '../../constants/knowledgeFlow';

function KnowledgeCandidateReviewList({
  candidates = [],
  candidateNotes = {},
  canReviewKnowledgeCandidates = false,
  handleNoteChange,
  handleApproveCandidate,
  handleRejectCandidate,
  pendingActionIds = [],
}) {
  if (candidates.length === 0) {
    return <div className="no-data-text">No suggested AI answers are waiting for review.</div>;
  }

  return candidates.map((cand) => {
    const note = candidateNotes[cand.id] || '';
    const isPending = pendingActionIds.includes(cand.id);
    const isActionDisabled = !String(note).trim() || isPending;

    return (
      <div key={cand.id} className="candidate-card-item">
        <span className="badge-cand">
          {formatKnowledgeCandidateStatus(cand.status)} · {cand.courseId || 'Course knowledge'}
        </span>
        <div className="compare-box">
          <div className="compare-qa"><strong>Question:</strong> {cand.question || '-'}</div>
          <div className="compare-qa teacher-a"><strong>Suggested answer:</strong> {cand.content || cand.answer || '-'}</div>
        </div>

        {canReviewKnowledgeCandidates ? (
          <>
            <div style={{ marginTop: 10, marginBottom: 10 }}>
              <input
                type="text"
                placeholder="Required approval note or rejection reason..."
                value={note}
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
                {isPending ? 'Processing...' : 'Approve into AI knowledge'}
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
                {isPending ? 'Processing...' : 'Reject'}
              </button>
            </div>
          </>
        ) : (
          <div className="no-data-text" style={{ textAlign: 'left' }}>
            You can review this suggested answer, but only Admin or Senior Mentor can approve it into AI knowledge.
          </div>
        )}
      </div>
    );
  });
}

export default KnowledgeCandidateReviewList;
