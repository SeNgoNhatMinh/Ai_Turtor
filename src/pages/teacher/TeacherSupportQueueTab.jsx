import React from 'react';
import { CheckCircle, RefreshCw } from 'lucide-react';

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
  candidateClassId,
  setCandidateClassId,
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
}) {
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

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', marginTop: 12, marginBottom: 16, padding: '8px 12px', background: 'rgba(243, 112, 33, 0.03)', border: '1px solid rgba(243, 112, 33, 0.12)', borderRadius: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500, margin: 0 }}>
                <input
                  type="checkbox"
                  checked={createKnowledgeCandidate}
                  onChange={(e) => setCreateKnowledgeCandidate(e.target.checked)}
                  style={{ cursor: 'pointer', width: 15, height: 15 }}
                />
                Propose this answer for AI knowledge review
              </label>
              {createKnowledgeCandidate && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: '#6B7280' }}>Knowledge type:</span>
                  <select
                    value={candidateType}
                    onChange={(e) => setCandidateType(e.target.value)}
                    style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d9d9d9', fontSize: 12, background: '#fff', cursor: 'pointer' }}
                  >
                    <option value="ACADEMIC_KNOWLEDGE">Academic knowledge</option>
                    <option value="OPERATIONAL_POLICY">Class policy</option>
                  </select>

                  {candidateType === 'OPERATIONAL_POLICY' && (
                    <>
                      <span style={{ fontSize: 12, color: '#6B7280', marginLeft: 8 }}>Apply to class:</span>
                      <input
                        type="text"
                        value={candidateClassId}
                        onChange={(e) => setCandidateClassId(e.target.value)}
                        placeholder="Class code"
                        style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d9d9d9', fontSize: 12, background: '#fff' }}
                      />
                    </>
                  )}
                </div>
              )}
            </div>

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
                  <div className="candidate-actions">
                    <button type="button" className="btn-approve-cand" onClick={() => handleSeniorResolveReview(review.id, 'APPROVE_FEEDBACK', 'Approved by senior mentor')}>
                      Approve feedback
                    </button>
                    <button type="button" className="btn-reject-cand" onClick={() => handleSeniorResolveReview(review.id, 'CREATE_KNOWLEDGE_CANDIDATE', 'Create knowledge candidate from correction')}>
                      Create knowledge
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="card-header" style={{ marginTop: 24 }}>
          <h3>Review Suggested AI Answers</h3>
        </div>
        <div className="candidates-list">
          {candidates.length === 0 ? (
            <div className="no-data-text">No suggested AI answers are waiting for review.</div>
          ) : (
            candidates.map((cand) => (
              <div key={cand.id} className="candidate-card-item">
                <span className="badge-cand">Suggested AI answer: {cand.courseId || 'Course knowledge'}</span>
                <div className="compare-box">
                  <div className="compare-qa"><strong>Question:</strong> {cand.question || '-'}</div>
                  <div className="compare-qa teacher-a"><strong>Suggested answer:</strong> {cand.content || cand.answer || '-'}</div>
                </div>

                <div style={{ marginTop: 10, marginBottom: 10 }}>
                  <input
                    type="text"
                    placeholder="Optional approval note or rejection reason..."
                    value={candidateNotes[cand.id] || ''}
                    onChange={(e) => handleNoteChange(cand.id, e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #d9d9d9', fontSize: 12 }}
                  />
                </div>

                <div className="candidate-actions">
                  <button
                    type="button"
                    className="btn-approve-cand"
                    onClick={() => {
                      handleApproveCandidate(cand.id, candidateNotes[cand.id] || 'Approved');
                      handleNoteChange(cand.id, '');
                    }}
                  >
                    Approve for AI Tutor
                  </button>
                  <button
                    type="button"
                    className="btn-reject-cand"
                    onClick={() => {
                      handleRejectCandidate(cand.id, candidateNotes[cand.id] || 'Rejected by mentor');
                      handleNoteChange(cand.id, '');
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default TeacherSupportQueueTab;
