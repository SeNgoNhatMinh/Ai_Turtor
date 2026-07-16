import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { canReviewKnowledge } from '../../utils/permissions';
import KnowledgeCandidateReviewList from './KnowledgeCandidateReviewList';
import TeacherAnswerModeSelector from './TeacherAnswerModeSelector';
import SupportChatRoom from '../../components/support/SupportChatRoom';
import AnswerReviewCard from '../../features/teacher/review/AnswerReviewCard';

function TeacherSupportQueueTab({
  isTeacherInboxLoading,
  escalations = [],
  selectedEscalation,
  setSelectedEscalation,
  loadTeacherInbox,
  teacherEscReply,
  setTeacherEscReply,
  onAnswerEsc,
  createKnowledgeCandidate,
  setCreateKnowledgeCandidate,
  candidateType,
  setCandidateType,
  answerReviews = [],
  isAnswerReviewsLoading = false,
  loadAnswerReviews,
  seniorAnswerReviews = [],
  pendingCandidateActionIds = [],
  pendingSeniorReviewIds = [],
  handleSeniorResolveReview,
  candidates = [],
  candidateNotes = {},
  handleNoteChange,
  handleApproveCandidate,
  handleRejectCandidate,
  currentUserRole,
  currentUser,
}) {
  const [seniorResolutionDrafts, setSeniorResolutionDrafts] = useState({});
  const canReviewKnowledgeCandidates = canReviewKnowledge(currentUserRole);
  const selectedStatus = String(selectedEscalation?.status || '').toUpperCase();
  const isSelectedChatActive = ['IN_CHAT', 'CHAT_ACTIVE'].includes(selectedStatus);
  const isSelectedAnswered = selectedStatus.includes('ANSWERED') || ['COMPLETED', 'CLOSED'].includes(selectedStatus);
  const activeReviewQueue = canReviewKnowledgeCandidates ? seniorAnswerReviews : answerReviews;
  const activeQueueType = canReviewKnowledgeCandidates ? 'senior' : 'mentor';

  const updateSeniorDraft = (reviewId, patch) => {
    setSeniorResolutionDrafts((current) => ({
      ...current,
      [reviewId]: {
        notes: '',
        correctedAnswer: '',
        candidateType: 'ACADEMIC_KNOWLEDGE',
        ...current[reviewId],
        ...patch,
      },
    }));
  };

  const resolveSeniorReview = async (reviewId, decision) => {
    const draft = seniorResolutionDrafts[reviewId] || {};
    const succeeded = await handleSeniorResolveReview(
      reviewId,
      decision,
      String(draft.notes || '').trim(),
      String(draft.correctedAnswer || '').trim(),
      draft.candidateType || 'ACADEMIC_KNOWLEDGE',
    );
    if (succeeded) {
      setSeniorResolutionDrafts((current) => {
        const next = { ...current };
        delete next[reviewId];
        return next;
      });
    }
  };

  return (
    <div className="grid-2-cols portal-view">
      <div className="glass-card">
        <div className="card-header">
          <h3>Student Support Queue</h3>
          <button type="button" className="btn-small-chat" onClick={() => loadTeacherInbox?.()}>
            <RefreshCw style={{ width: 12, height: 12 }} /> Refresh
          </button>
        </div>
        {isTeacherInboxLoading ? (
          <p className="no-data-text">Loading teacher inbox...</p>
        ) : escalations.length === 0 ? (
          <p className="no-data-text">No support requests in inbox.</p>
        ) : (
          <div className="escalations-list">
            {escalations.map((esc) => (
              <div
                key={esc.id}
                className={`escalation-card-item ${selectedEscalation?.id === esc.id ? 'active-escalation' : ''}`}
                onClick={() => setSelectedEscalation(esc)}
              >
                <span className="badge-esc pending">{String(esc.status).toUpperCase()}</span>
                <h5>{esc.student}: {esc.title}</h5>
                <p className="esc-context">{esc.context}</p>
                <span className="esc-time">{esc.time ? new Date(esc.time).toLocaleString() : '-'}</span>
              </div>
            ))}
          </div>
        )}
        {selectedEscalation?.chatRoomId && isSelectedChatActive && (
          <div className="escalation-chat-reply-box">
            <h5>Live support discussion</h5>
            <SupportChatRoom
              chatRoomId={selectedEscalation.chatRoomId}
              currentUser={currentUser}
              compact
            />
          </div>
        )}
        {selectedEscalation && !isSelectedChatActive && !isSelectedAnswered && (
          <div className="escalation-chat-reply-box">
            <h5>Waiting for student selection</h5>
            <p className="no-data-text" style={{ textAlign: 'left' }}>
              The student must choose the matched teacher before the backend creates a ChatRoom. The official answer becomes available after that discussion starts.
            </p>
          </div>
        )}
        {selectedEscalation && isSelectedChatActive && (
          <form className="escalation-chat-reply-box" onSubmit={onAnswerEsc}>
            <h5>Official final answer</h5>
            <div className="escalation-meta-info">
              <strong>Question:</strong> {selectedEscalation.question}
            </div>
            <div className="input-group">
              <label>Final answer after the support discussion:</label>
              <textarea value={teacherEscReply} onChange={(e) => setTeacherEscReply(e.target.value)} required />
            </div>

            <TeacherAnswerModeSelector
              createKnowledgeCandidate={createKnowledgeCandidate}
              candidateType={candidateType}
              setCreateKnowledgeCandidate={setCreateKnowledgeCandidate}
              setCandidateType={setCandidateType}
            />

            <button type="submit" className="btn-submit-form">Submit official answer</button>
          </form>
        )}
      </div>

      <div className="glass-card">
        <div className="card-header">
          <div>
            <h3>{canReviewKnowledgeCandidates ? 'Senior Answer Review Queue' : 'Teacher Answer Review Queue'}</h3>
            <p className="answer-review-section__subtitle">
              {canReviewKnowledgeCandidates
                ? 'Serious knowledge, source, and material issues requiring senior validation.'
                : 'Moderate answer disputes submitted by students in your course.'}
            </p>
          </div>
          <button type="button" className="btn-small-chat" onClick={() => loadAnswerReviews?.()}>
            <RefreshCw style={{ width: 12, height: 12 }} />
          </button>
        </div>
        <div className="answer-review-list">
          {isAnswerReviewsLoading ? (
            <div className="no-data-text">Loading answer reviews...</div>
          ) : activeReviewQueue.length === 0 ? (
            <div className="no-data-text">
              {canReviewKnowledgeCandidates
                ? 'No serious AI answer issues are waiting for senior review.'
                : 'No AI answer disputes are waiting for teacher review.'}
            </div>
          ) : (
            activeReviewQueue.map((review) => (
              <AnswerReviewCard
                key={review.id}
                review={review}
                queue={activeQueueType}
                draft={seniorResolutionDrafts[review.id]}
                isPending={pendingSeniorReviewIds.includes(review.id)}
                onDraftChange={(patch) => updateSeniorDraft(review.id, patch)}
                onResolve={(decision) => resolveSeniorReview(review.id, decision)}
              />
            ))
          )}
        </div>

        {canReviewKnowledgeCandidates && (
          <>
            <div className="card-header answer-review-candidate-header">
              <div>
                <h3>Knowledge Candidates</h3>
                <p className="answer-review-section__subtitle">
                  Approve to index into course RAG knowledge, or reject without changing AI.
                </p>
              </div>
            </div>
            <div className="candidates-list">
              <KnowledgeCandidateReviewList
                candidates={candidates}
                candidateNotes={candidateNotes}
                canReviewKnowledgeCandidates={canReviewKnowledgeCandidates}
                handleNoteChange={handleNoteChange}
                handleApproveCandidate={handleApproveCandidate}
                handleRejectCandidate={handleRejectCandidate}
                pendingActionIds={pendingCandidateActionIds}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default TeacherSupportQueueTab;
