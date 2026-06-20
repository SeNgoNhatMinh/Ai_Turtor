import React, { useEffect, useRef, useState } from 'react';
import {
  MessageSquare,
  Download,
  CheckCircle,
  RefreshCw,
  Send,
} from 'lucide-react';
import { apiService } from '../services/api';

const HEATMAP_CLASS = {
  high: 'val-high',
  medium: 'val-med',
  med: 'val-med',
  warning: 'val-med',
  low: 'val-low',
  none: 'val-none',
  strong: 'val-none',
};

function TeacherPortal({
  activeTab,
  courseId,
  classId,
  setClassId,
  classesList,
  teacherStudents,
  teacherSubmissions,
  selectedTeacherSub,
  setSelectedTeacherSub,
  uploadProgress,
  uploadProgressText,
  escalations,
  selectedEscalation,
  setSelectedEscalation,
  candidates,
  answerReviews,
  seniorAnswerReviews,
  teacherChatInbox,
  isTeacherInboxLoading,
  teacherTopicHeatmap,
  teacherDashboardLoading,
  teacherUserId,
  loadTeacherInbox,
  loadTeacherDashboard,
  loadAnswerReviews,
  handleTeacherUploadMaterial,
  handleTeacherGradeSubmit,
  handleTeacherAnswerEsc,
  handleApproveCandidate,
  handleRejectCandidate,
  handleMentorReviewAnswer,
  handleSeniorResolveReview,
  onMarkChatRead,
  onCloseChat,
  onGetChatDetail,
  onSendChatMessage,
  onGetChatHistory,
  triggerToast,
}) {
  const [teacherMaterialTitle, setTeacherMaterialTitle] = useState('');
  const [teacherMaterialClass, setTeacherMaterialClass] = useState('');
  const [teacherMaterialFile, setTeacherMaterialFile] = useState(null);

  const [teacherGradeScore, setTeacherGradeScore] = useState('');
  const [teacherGradeFeedback, setTeacherGradeFeedback] = useState('');
  const [teacherGradeWeakTopics, setTeacherGradeWeakTopics] = useState([]);

  const [teacherEscReply, setTeacherEscReply] = useState('');

  const [newAssignmentTitle, setNewAssignmentTitle] = useState('');
  const [newAssignmentDesc, setNewAssignmentDesc] = useState('');
  const [newAssignmentClass, setNewAssignmentClass] = useState('SE1840');
  const [newAssignmentDeadline, setNewAssignmentDeadline] = useState('');

  const [selectedChatEsc, setSelectedChatEsc] = useState(null);
  const [teacherChatMessages, setTeacherChatMessages] = useState([]);
  const [teacherChatInput, setTeacherChatInput] = useState('');
  const [chatRoomDetail, setChatRoomDetail] = useState(null);
  const teacherChatEndRef = useRef(null);

  useEffect(() => {
    teacherChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [teacherChatMessages]);

  useEffect(() => {
    if (activeTab === 'teacher-escalations') {
      loadTeacherInbox?.();
      loadAnswerReviews?.();
    }
    if (activeTab === 'teacher-classes') {
      loadTeacherDashboard?.();
    }
    if (activeTab === 'teacher-chat') {
      loadTeacherInbox?.();
    }
  }, [activeTab, courseId]);

  const onUploadMaterial = (e) => {
    e.preventDefault();
    if (!teacherMaterialFile) return;
    handleTeacherUploadMaterial(teacherMaterialTitle, teacherMaterialClass, teacherMaterialFile).then(() => {
      setTeacherMaterialTitle('');
      setTeacherMaterialClass('');
      setTeacherMaterialFile(null);
    });
  };

  const onGradeSubmit = (e) => {
    e.preventDefault();
    handleTeacherGradeSubmit(selectedTeacherSub.id, teacherGradeScore, teacherGradeFeedback, teacherGradeWeakTopics).then(() => {
      setTeacherGradeScore('');
      setTeacherGradeFeedback('');
      setTeacherGradeWeakTopics([]);
    });
  };

  const onAnswerEsc = (e) => {
    e.preventDefault();
    if (!teacherEscReply.trim()) return;
    handleTeacherAnswerEsc(selectedEscalation.id, teacherEscReply).then(() => {
      setTeacherEscReply('');
    });
  };

  const onCreateAssignment = (e) => {
    e.preventDefault();
    triggerToast('New assignment published.');
    setNewAssignmentTitle('');
    setNewAssignmentDesc('');
    setNewAssignmentDeadline('');
  };

  const handleDownloadSubmission = async (submissionId) => {
    triggerToast('Downloading submission file...');
    try {
      const blob = await apiService.downloadSubmissionFile(submissionId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Submission_${submissionId}_File`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      triggerToast('Unable to download the file right now.');
    }
  };

  const handleSelectTeacherChat = async (esc) => {
    setSelectedChatEsc(esc);
    setChatRoomDetail(null);
    if (!esc.chatRoomId) {
      setTeacherChatMessages([]);
      return;
    }
    try {
      if (onMarkChatRead) await onMarkChatRead(esc.chatRoomId);
      if (onGetChatDetail) setChatRoomDetail(await onGetChatDetail(esc.chatRoomId));
      const history = onGetChatHistory ? await onGetChatHistory(esc.chatRoomId) : [];
      setTeacherChatMessages(Array.isArray(history) ? history : []);
    } catch {
      setTeacherChatMessages([]);
    }
  };

  const onSendTeacherChat = async () => {
    if (!teacherChatInput.trim() || !selectedChatEsc?.chatRoomId) return;
    const msgData = {
      chatRoomId: selectedChatEsc.chatRoomId,
      senderId: teacherUserId,
      content: teacherChatInput,
    };
    await onSendChatMessage(msgData);
    setTeacherChatMessages((prev) => [...prev, { ...msgData, timestamp: new Date().toISOString() }]);
    setTeacherChatInput('');
  };

  const onCloseTeacherChat = async () => {
    if (!selectedChatEsc?.chatRoomId || !onCloseChat) return;
    try {
      await onCloseChat({
        chatRoomId: selectedChatEsc.chatRoomId,
        questionEscalationId: selectedChatEsc.id,
      });
      triggerToast('Support chat closed.');
      setTeacherChatMessages([]);
      setSelectedChatEsc(null);
      loadTeacherInbox?.();
    } catch {
      triggerToast('Unable to close chat.');
    }
  };

  const heatmapNodes = teacherTopicHeatmap.length
    ? teacherTopicHeatmap
    : [
        { label: 'JPA Relations (Weak)', level: 'high' },
        { label: 'Spring Security (Warning)', level: 'med' },
        { label: 'REST APIs (Strong)', level: 'none' },
      ];

  const chatInbox = teacherChatInbox?.length ? teacherChatInbox : escalations.filter((e) => e.chatRoomId);

  return (
    <>
      {activeTab === 'teacher-classes' && (
        <div className="grid-2x2 portal-view">
          <div className="glass-card">
            <div className="card-header">
              <h3>Assigned Class Sections</h3>
              <button type="button" className="btn-small-chat" onClick={() => loadTeacherDashboard?.()}>
                <RefreshCw style={{ width: 12, height: 12 }} /> Refresh
              </button>
            </div>
            {teacherDashboardLoading ? (
              <p className="no-data-text">Loading dashboard...</p>
            ) : classesList.length === 0 ? (
              <p className="no-data-text">No class sections found.</p>
            ) : (
              <div className="teacher-classes-list">
                {classesList.map((c, i) => (
                  <div
                    key={i}
                    className={`class-card-item ${classId === c.classCode ? 'active-class' : ''}`}
                    onClick={() => setClassId(c.classCode)}
                  >
                    <span className="badge-semester">Term: {c.semester}</span>
                    <h4>{c.name}</h4>
                    <p>{c.details}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card">
            <div className="card-header">
              <h3>Class Knowledge Gap Heatmap (Class {classId})</h3>
              <span className="card-subtitle">From teacher dashboard API</span>
            </div>
            <div className="heatmap-container">
              <div className="heatmap-grid">
                {heatmapNodes.map((node, i) => (
                  <div key={i} className={`heatmap-node ${HEATMAP_CLASS[node.level] || 'val-none'}`}>
                    {node.label}
                  </div>
                ))}
              </div>
              <div className="heatmap-legend">
                <span className="legend-box val-high"></span> High risk (Red)
                <span className="legend-box val-med"></span> Needs attention (Yellow)
                <span className="legend-box val-none"></span> Strong (Green)
              </div>
            </div>
          </div>

          <div className="glass-card span-2">
            <div className="card-header">
              <h3>Class Student List ({classId})</h3>
            </div>
            {teacherStudents.length === 0 ? (
              <p className="no-data-text">No students loaded from dashboard.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student ID</th>
                    <th>Full Name</th>
                    <th>Email</th>
                    <th>Learning Status</th>
                    <th>Weak Topics</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherStudents.map((s) => (
                    <tr key={s.id}>
                      <td><code>{s.id}</code></td>
                      <td>{s.name}</td>
                      <td>{s.email}</td>
                      <td><span className="badge active-badge">{s.status}</span></td>
                      <td>
                        {s.weakTopics.map((wt, i) => (
                          <span key={i} className={wt === 'None' ? 'tag-healthy' : 'tag-weak'}>{wt}</span>
                        ))}
                      </td>
                      <td>
                        <button type="button" className="btn-small-chat" onClick={() => triggerToast(`Opening support chat with ${s.name}...`)}>
                          <MessageSquare style={{ width: 12, height: 12 }} /> Support
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'teacher-materials' && (
        <div className="grid-2-cols portal-view">
          <div className="glass-card">
            <div className="card-header">
              <h3>Upload Teaching PDF (Elasticsearch RAG)</h3>
            </div>
            <form className="portal-form" onSubmit={onUploadMaterial}>
              <div className="input-group">
                <label>Material title</label>
                <input
                  type="text"
                  className="glass-input-field"
                  value={teacherMaterialTitle}
                  onChange={(e) => setTeacherMaterialTitle(e.target.value)}
                  placeholder="Example: Advanced Spring Boot Data JPA lecture slides"
                  required
                />
              </div>
              <div className="grid-2-inputs">
                <div className="input-group">
                  <label>Course ID</label>
                  <input type="text" className="glass-input-field" value={courseId} readOnly />
                </div>
                <div className="input-group">
                  <label>Class ID (optional)</label>
                  <input
                    type="text"
                    className="glass-input-field"
                    value={teacherMaterialClass}
                    onChange={(e) => setTeacherMaterialClass(e.target.value)}
                    placeholder="Leave blank to apply to the whole course"
                  />
                </div>
              </div>
              <div className="input-group">
                <label>Course material file (PDF only)</label>
                <div className="file-upload-wrapper">
                  <input type="file" accept=".pdf" onChange={(e) => setTeacherMaterialFile(e.target.files[0])} required />
                </div>
              </div>
              <button type="submit" className="btn-submit-form">Start Upload</button>
            </form>
            {uploadProgress !== null && (
              <div className="upload-progress-box">
                <h5>AI Knowledge Upload Status:</h5>
                <div className="progress-bar-container">
                  <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }}></div>
                </div>
                <span className="progress-status-text">{uploadProgressText}</span>
              </div>
            )}
          </div>

          <div className="glass-card">
            <div className="card-header">
              <h3>Publish New Assignment</h3>
            </div>
            <form className="portal-form" onSubmit={onCreateAssignment}>
              <div className="input-group">
                <label>Assignment title</label>
                <input
                  type="text"
                  className="glass-input-field"
                  value={newAssignmentTitle}
                  onChange={(e) => setNewAssignmentTitle(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label>Assignment requirements</label>
                <textarea value={newAssignmentDesc} onChange={(e) => setNewAssignmentDesc(e.target.value)} required />
              </div>
              <div className="grid-2-inputs">
                <div className="input-group">
                  <label>Apply to class</label>
                  <select className="glass-select" value={newAssignmentClass} onChange={(e) => setNewAssignmentClass(e.target.value)}>
                    <option value="SE1840">Class SE1840</option>
                    <option value="SE1841">Class SE1841</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Submission deadline</label>
                  <input type="datetime-local" className="glass-input-field" value={newAssignmentDeadline} onChange={(e) => setNewAssignmentDeadline(e.target.value)} required />
                </div>
              </div>
              <button type="submit" className="btn-submit-form">Publish Assignment</button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'teacher-grading' && (
        <div className="grid-2-cols portal-view">
          <div className="glass-card">
            <div className="card-header"><h3>Student Submissions</h3></div>
            <div className="submissions-list-container">
              {teacherSubmissions.map((sub) => (
                <div
                  key={sub.id}
                  className={`submission-item-row ${selectedTeacherSub?.id === sub.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedTeacherSub(sub);
                    setTeacherGradeScore(sub.score || '');
                  }}
                >
                  <div className="sub-meta">
                    <span className="sub-student">{sub.student}</span>
                    <span className="sub-time">{sub.time}</span>
                  </div>
                  <h5>{sub.title}</h5>
                  <span className={`sub-status ${sub.status}`}>
                    {sub.status === 'pending' ? 'Pending grading' : `Graded: ${sub.score}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {selectedTeacherSub && (
            <div className="glass-card">
              <div className="card-header"><h3>Grade Submission</h3></div>
              <div className="grading-panel-body">
                <form className="portal-form" onSubmit={onGradeSubmit}>
                  <div className="input-group">
                    <label>Score (10-point scale)</label>
                    <input type="number" step="0.1" min="0" max="10" className="glass-input-field" value={teacherGradeScore} onChange={(e) => setTeacherGradeScore(e.target.value)} required />
                  </div>
                  <div className="input-group">
                    <label>Detailed feedback</label>
                    <textarea value={teacherGradeFeedback} onChange={(e) => setTeacherGradeFeedback(e.target.value)} required />
                  </div>
                  <button type="submit" className="btn-submit-form">Save Feedback</button>
                  <button type="button" className="btn-small-chat" onClick={() => handleDownloadSubmission(selectedTeacherSub.id)}>
                    <Download style={{ width: 12, height: 12 }} /> Download file
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'teacher-escalations' && (
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
                    <span className="esc-time">{esc.time ? new Date(esc.time).toLocaleString() : '—'}</span>
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
                      <div className="compare-qa"><strong>Question:</strong> {cand.question || '—'}</div>
                      <div className="compare-qa teacher-a"><strong>Suggested answer:</strong> {cand.content || cand.answer || '—'}</div>
                    </div>
                    <div className="candidate-actions">
                      <button type="button" className="btn-approve-cand" onClick={() => handleApproveCandidate(cand.id)}>Approve for AI Tutor</button>
                      <button type="button" className="btn-reject-cand" onClick={() => handleRejectCandidate(cand.id)}>Reject</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'teacher-chat' && (
        <div className="grid-2-cols portal-view">
          <div className="glass-card">
            <div className="card-header">
              <h3>Active Support Chats</h3>
              <button type="button" className="btn-small-chat" onClick={() => loadTeacherInbox?.()}>
                <RefreshCw style={{ width: 12, height: 12 }} /> Refresh
              </button>
            </div>
            {chatInbox.length === 0 ? (
              <p className="no-data-text">No active 1-on-1 support chats.</p>
            ) : (
              <div className="escalations-list">
                {chatInbox.map((esc) => (
                  <div
                    key={esc.id}
                    className={`escalation-card-item ${selectedChatEsc?.id === esc.id ? 'active-escalation' : ''}`}
                    onClick={() => handleSelectTeacherChat(esc)}
                  >
                    <span className="badge-esc pending">{String(esc.status).toUpperCase()}</span>
                    <h5>{esc.student}</h5>
                    <p className="esc-context">{esc.title}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card">
            <div className="card-header">
              <h3>Live Chat</h3>
              {selectedChatEsc && (
                <button type="button" className="btn-reject-cand" onClick={onCloseTeacherChat}>Close chat</button>
              )}
            </div>
            {!selectedChatEsc ? (
              <p className="no-data-text">Select a support chat from the inbox.</p>
            ) : (
              <>
                {chatRoomDetail?.status && <p className="esc-context">Room status: {chatRoomDetail.status}</p>}
                <div className="chat-message-list" style={{ minHeight: 280, maxHeight: 400, overflowY: 'auto', padding: 12 }}>
                  {teacherChatMessages.map((msg, idx) => (
                    <div key={idx} className={`support-message ${msg.senderId === teacherUserId ? 'mine' : ''}`}>
                      <div className={`support-bubble ${msg.senderId === teacherUserId ? 'mine' : ''}`}>{msg.content}</div>
                    </div>
                  ))}
                  <div ref={teacherChatEndRef} />
                </div>
                <form
                  className="escalation-chat-reply-box"
                  onSubmit={(e) => { e.preventDefault(); onSendTeacherChat(); }}
                >
                  <div className="input-group" style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      className="glass-input-field"
                      value={teacherChatInput}
                      onChange={(e) => setTeacherChatInput(e.target.value)}
                      placeholder="Reply to student..."
                    />
                    <button type="submit" className="btn-submit-form">
                      <Send style={{ width: 14, height: 14, display: 'inline-block' }} /> Send
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default TeacherPortal;
