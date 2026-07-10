import React from 'react';
import { CheckCircle, RefreshCw } from 'lucide-react';
import { canReviewKnowledge } from '../../utils/permissions';
import KnowledgeCandidateReviewList from './KnowledgeCandidateReviewList';
import TeacherAnswerModeSelector from './TeacherAnswerModeSelector';

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
  handleSeniorResolveReview,
  candidates = [],
  candidateNotes = {},
  handleNoteChange,
  handleApproveCandidate,
  handleRejectCandidate,
  currentUserRole,
}) {
  const canReviewKnowledgeCandidates = canReviewKnowledge(currentUserRole);

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
        {selectedEscalation && (
          <form className="escalation-chat-reply-box" onSubmit={onAnswerEsc}>
            <h5>Difficult Question Response Thread:</h5>
            <div className="escalation-meta-info">
              <strong>Question:</strong> {selectedEscalation.question}
            </div>
            <div className="input-group">
              <label>Enter your explanation:</label>
              <textarea value={teacherEscReply} onChange={(e) => setTeacherEscReply(e.target.value)} required />
            </div>

            <TeacherAnswerModeSelector
              createKnowledgeCandidate={createKnowledgeCandidate}
              candidateType={candidateType}
              setCreateKnowledgeCandidate={setCreateKnowledgeCandidate}
              setCandidateType={setCandidateType}
            />

            <button type="submit" className="btn-submit-form">Send Answer to Student</button>
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
                    <div className="candidate-actions">
                      <button type="button" className="btn-approve-cand" onClick={() => handleSeniorResolveReview(review.id, 'APPROVE_FEEDBACK', 'Approved by senior mentor')}>
                        Approve feedback
                      </button>
                      <button type="button" className="btn-reject-cand" onClick={() => handleSeniorResolveReview(review.id, 'CREATE_KNOWLEDGE_CANDIDATE', 'Create knowledge candidate from correction')}>
                        Create knowledge
                      </button>
                    </div>
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
          />
        </div>
      </div>
    </div>
  );
}

export default TeacherSupportQueueTab;
