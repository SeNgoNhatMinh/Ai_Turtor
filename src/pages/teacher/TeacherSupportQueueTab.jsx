import { useState } from 'react';
import { CheckCircle, RefreshCw } from 'lucide-react';
import { canReviewKnowledge } from '../../utils/permissions';
import KnowledgeCandidateReviewList from './KnowledgeCandidateReviewList';
import TeacherAnswerModeSelector from './TeacherAnswerModeSelector';
import SupportChatRoom from '../../components/support/SupportChatRoom';

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
  loadAnswerReviews,
  handleMentorReviewAnswer,
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
  const [seniorResolutionNotes, setSeniorResolutionNotes] = useState({});
  const canReviewKnowledgeCandidates = canReviewKnowledge(currentUserRole);
  const selectedStatus = String(selectedEscalation?.status || '').toUpperCase();
  const isSelectedChatActive = ['IN_CHAT', 'CHAT_ACTIVE'].includes(selectedStatus);
  const isSelectedAnswered = selectedStatus.includes('ANSWERED') || ['COMPLETED', 'CLOSED'].includes(selectedStatus);

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
          <h3>AI Answer Reviews (Mentor Pending)</h3>
          <button type="button" className="btn-small-chat" onClick={() => loadAnswerReviews?.()}>
            <RefreshCw style={{ width: 12, height: 12 }} />
          </button>
        </div>
        <div className="candidates-list">
          {answerReviews.length === 0 ? (
            <div className="no-data-text">No AI answer disputes waiting for mentor review.</div>
          ) : (
            answerReviews.map((review) => (
              <div key={review.id} className="candidate-card-item">
                <span className="badge-cand">{review.reviewType} · {review.status}</span>
                <div className="compare-box">
                  <div className="compare-qa"><strong>Question:</strong> {review.question}</div>
                  <div className="compare-qa teacher-a"><strong>AI Answer:</strong> {review.answer}</div>
                </div>
                <div className="candidate-actions">
                  <button type="button" className="btn-approve-cand" onClick={() => handleMentorReviewAnswer(review, true, 'AI answer confirmed by mentor')}>
                    <CheckCircle style={{ width: 12, height: 12, display: 'inline-block' }} /> Confirm AI answer
                  </button>
                  <button type="button" className="btn-reject-cand" onClick={() => handleMentorReviewAnswer(review, false, 'AI answer flagged as incorrect')}>
                    AI was wrong
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {seniorAnswerReviews.length > 0 && (
          <>
            <div className="card-header" style={{ marginTop: 24 }}>
              <h3>Senior Review Queue</h3>
            </div>
            <div className="candidates-list">
              {seniorAnswerReviews.map((review) => (
                <div key={review.id} className="candidate-card-item">
                  <span className="badge-cand">Senior · {review.status}</span>
                  <div className="compare-qa"><strong>Q:</strong> {review.question}</div>
                  <div className="compare-qa"><strong>A:</strong> {review.answer}</div>
                  {canReviewKnowledgeCandidates ? (
                    <>
                      <textarea
                        className="senior-review-note"
                        value={seniorResolutionNotes[review.id] || ''}
                        onChange={(event) => setSeniorResolutionNotes((current) => ({
                          ...current,
                          [review.id]: event.target.value,
                        }))}
                        placeholder="Required review note. For reusable knowledge, enter the corrected academic answer."
                        rows={3}
                      />
                      <div className="candidate-actions">
                        <button
                          type="button"
                          className="btn-approve-cand"
                          disabled={!String(seniorResolutionNotes[review.id] || '').trim() || pendingSeniorReviewIds.includes(review.id)}
                          onClick={async () => {
                            const note = String(seniorResolutionNotes[review.id] || '').trim();
                            const succeeded = await handleSeniorResolveReview(review.id, 'APPROVE_FEEDBACK', note);
                            if (succeeded) setSeniorResolutionNotes((current) => ({ ...current, [review.id]: '' }));
                          }}
                        >
                          {pendingSeniorReviewIds.includes(review.id) ? 'Processing...' : 'Approve feedback'}
                        </button>
                        <button
                          type="button"
                          className="btn-reject-cand"
                          disabled={!String(seniorResolutionNotes[review.id] || '').trim() || pendingSeniorReviewIds.includes(review.id)}
                          onClick={async () => {
                            const correctedAnswer = String(seniorResolutionNotes[review.id] || '').trim();
                            const succeeded = await handleSeniorResolveReview(
                              review.id,
                              'CREATE_KNOWLEDGE_CANDIDATE',
                              'Create a reusable academic knowledge candidate from the corrected answer.',
                              correctedAnswer,
                            );
                            if (succeeded) setSeniorResolutionNotes((current) => ({ ...current, [review.id]: '' }));
                          }}
                        >
                          {pendingSeniorReviewIds.includes(review.id) ? 'Processing...' : 'Create knowledge'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="no-data-text" style={{ textAlign: 'left' }}>Senior/Admin permission is required to resolve this review.</div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="card-header" style={{ marginTop: 24 }}>
          <h3>Review Suggested AI Answers</h3>
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
      </div>
    </div>
  );
}

export default TeacherSupportQueueTab;
