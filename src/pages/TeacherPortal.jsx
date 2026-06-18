import React, { useState } from 'react';
import { 
  LayoutGrid, 
  UploadCloud, 
  CheckSquare, 
  Inbox, 
  MessageSquare,
  FileText,
  Download,
  Upload,
  CheckCircle,
  FileArchive,
  Info
} from 'lucide-react';
import { apiService } from '../services/api';

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
  setCandidates,
  handleTeacherUploadMaterial,
  handleTeacherGradeSubmit,
  handleTeacherAnswerEsc,
  handleApproveCandidate,
  handleRejectCandidate,
  triggerToast
}) {
  // Local form states
  const [teacherMaterialTitle, setTeacherMaterialTitle] = useState('');
  const [teacherMaterialClass, setTeacherMaterialClass] = useState('');
  const [teacherMaterialFile, setTeacherMaterialFile] = useState(null);

  const [teacherGradeScore, setTeacherGradeScore] = useState('');
  const [teacherGradeFeedback, setTeacherGradeFeedback] = useState('');
  const [teacherGradeWeakTopics, setTeacherGradeWeakTopics] = useState([]);

  const [teacherEscReply, setTeacherEscReply] = useState('');

  // New assignment states
  const [newAssignmentTitle, setNewAssignmentTitle] = useState('');
  const [newAssignmentDesc, setNewAssignmentDesc] = useState('');
  const [newAssignmentClass, setNewAssignmentClass] = useState('SE1840');
  const [newAssignmentDeadline, setNewAssignmentDeadline] = useState('');

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

  const onApproveCandidate = (id) => {
    handleApproveCandidate(id);
  };

  const onRejectCandidate = (id) => {
    handleRejectCandidate(id);
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
    } catch (e) {
      triggerToast('Unable to download the file right now.');
    }
  };

  return (
    <>
      {/* ================= TEACHER CLASSES TAB ================= */}
      {activeTab === 'teacher-classes' && (
        <div className="grid-2x2 portal-view">
          <div className="glass-card">
            <div className="card-header">
              <h3>Assigned Class Sections</h3>
            </div>
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
          </div>

          <div className="glass-card">
            <div className="card-header">
              <h3>Class Knowledge Gap Heatmap (Class {classId})</h3>
              <span className="card-subtitle">Student weakness summary</span>
            </div>
            <div className="heatmap-container">
              <div className="heatmap-grid">
                <div className="heatmap-node val-high">JPA Relations (Weak)</div>
                <div className="heatmap-node val-med">Spring Security (Warning)</div>
                <div className="heatmap-node val-none">REST APIs (Strong)</div>
                <div className="heatmap-node val-none">MVC Flow (Strong)</div>
                <div className="heatmap-node val-low">Maven Dependencies (OK)</div>
                <div className="heatmap-node val-med">JWT Filters (Warning)</div>
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
                {teacherStudents.map(s => (
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
                      <button className="btn-small-chat" onClick={() => triggerToast(`Opening support chat with ${s.name}...`)}>
                        <MessageSquare style={{ width:12, height: 12 }} /> Support
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TEACHER MATERIALS UPLOAD TAB ================= */}
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
                  onChange={e => setTeacherMaterialTitle(e.target.value)} 
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
                    onChange={e => setTeacherMaterialClass(e.target.value)} 
                    placeholder="Leave blank to apply to the whole course" 
                  />
                </div>
              </div>
              <div className="input-group">
                <label>Course material file (PDF only)</label>
                <div className="file-upload-wrapper">
                  <input 
                    type="file" 
                    accept=".pdf" 
                    onChange={e => setTeacherMaterialFile(e.target.files[0])} 
                    required 
                  />
                  <p className="file-help">After upload, the file is prepared for AI Tutor so students can ask questions about it.</p>
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
                  placeholder="Example: Lab 4: Spring Data JPA Repository & Query annotations" 
                  value={newAssignmentTitle}
                  onChange={e => setNewAssignmentTitle(e.target.value)}
                  required 
                />
              </div>
              <div className="input-group">
                <label>Assignment requirements</label>
                <textarea 
                  placeholder="Enter assignment requirements here..." 
                  value={newAssignmentDesc}
                  onChange={e => setNewAssignmentDesc(e.target.value)}
                  required
                ></textarea>
              </div>
              <div className="grid-2-inputs">
                <div className="input-group">
                  <label>Apply to class</label>
                  <select className="glass-select" value={newAssignmentClass} onChange={e => setNewAssignmentClass(e.target.value)}>
                    <option value="SE1840">Class SE1840</option>
                    <option value="SE1841">Class SE1841</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Submission deadline</label>
                  <input 
                    type="datetime-local" 
                    className="glass-input-field" 
                    value={newAssignmentDeadline}
                    onChange={e => setNewAssignmentDeadline(e.target.value)}
                    required 
                  />
                </div>
              </div>
              <button type="submit" className="btn-submit-form">Publish Assignment</button>
            </form>
          </div>
        </div>
      )}

      {/* ================= TEACHER GRADING TAB ================= */}
      {activeTab === 'teacher-grading' && (
        <div className="grid-2-cols portal-view">
          <div className="glass-card">
            <div className="card-header">
              <h3>Student Submissions</h3>
            </div>
            <div className="submissions-list-container">
              {teacherSubmissions.map(sub => (
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
              <div className="card-header">
                <h3>Grade Submission</h3>
              </div>
              <div className="grading-panel-body">
                <div className="student-info-row">
                  <div className="info-item">
                    <span className="label">Student:</span>
                    <span className="value">{selectedTeacherSub.student}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Submission:</span>
                    <span className="value">
                      <a href="#" onClick={e => { e.preventDefault(); handleDownloadSubmission(selectedTeacherSub.id); }}>
                        <Download style={{ width:12, height:12 }} /> Submission file ({selectedTeacherSub.id})
                      </a>
                    </span>
                  </div>
                </div>
                
                <div className="student-note-box">
                  <h5>Submission note:</h5>
                  <p>{selectedTeacherSub.note}</p>
                </div>

                <form className="portal-form" onSubmit={onGradeSubmit}>
                  <div className="input-group">
                    <label>Score (10-point scale)</label>
                    <input 
                      type="number" 
                      step="0.1" 
                      min="0" 
                      max="10" 
                      className="glass-input-field" 
                      value={teacherGradeScore} 
                      onChange={e => setTeacherGradeScore(e.target.value)} 
                      placeholder="Enter score..." 
                      required 
                    />
                  </div>
                  <div className="input-group">
                    <label>Detailed feedback / code review notes</label>
                    <textarea 
                      value={teacherGradeFeedback} 
                      onChange={e => setTeacherGradeFeedback(e.target.value)} 
                      placeholder="Write feedback and guidance for improving the submission..." 
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label>Weak topics detected in this submission</label>
                    <div className="weak-topics-tags-selector">
                      {['JPA Relations', 'Spring Security', 'REST APIs', 'Maven Config'].map(tag => (
                        <label key={tag}>
                          <input 
                            type="checkbox" 
                            checked={teacherGradeWeakTopics.includes(tag)}
                            onChange={e => {
                              if (e.target.checked) {
                                setTeacherGradeWeakTopics([...teacherGradeWeakTopics, tag]);
                              } else {
                                setTeacherGradeWeakTopics(teacherGradeWeakTopics.filter(t => t !== tag));
                              }
                            }}
                          /> {tag}
                        </label>
                      ))}
                    </div>
                  </div>
                  <button type="submit" className="btn-submit-form">Save Feedback</button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= TEACHER ESCALATIONS TAB ================= */}
      {activeTab === 'teacher-escalations' && (
        <div className="grid-2-cols portal-view">
          <div className="glass-card">
            <div className="card-header">
              <h3>Student Support Queue</h3>
            </div>
            <div className="escalations-list">
              {escalations.map(esc => (
                <div 
                  key={esc.id} 
                  className={`escalation-card-item ${selectedEscalation?.id === esc.id ? 'active-escalation' : ''}`}
                  onClick={() => setSelectedEscalation(esc)}
                >
                  <span className="badge-esc pending">{esc.status.toUpperCase()}</span>
                  <h5>{esc.student}: {esc.title}</h5>
                  <p className="esc-context">{esc.context}</p>
                  <span className="esc-time">{esc.time}</span>
                </div>
              ))}
            </div>
            {selectedEscalation && (
              <form className="escalation-chat-reply-box" onSubmit={onAnswerEsc}>
                <h5>Difficult Question Response Thread:</h5>
                <div className="escalation-meta-info">
                  <strong>Question:</strong> {selectedEscalation.question}
                </div>
                <div className="input-group">
                  <label>Enter your explanation:</label>
                  <textarea 
                    value={teacherEscReply} 
                    onChange={e => setTeacherEscReply(e.target.value)} 
                    placeholder="Guide the student through the fix or provide the underlying concept..." 
                    required 
                  />
                </div>
                <button type="submit" className="btn-submit-form">Send Answer to Student</button>
              </form>
            )}
          </div>

          <div className="glass-card">
            <div className="card-header">
              <h3>Review Suggested AI Answers</h3>
            </div>
            <div className="candidates-list">
              {candidates.length === 0 ? (
                <div className="no-data-text">No suggested AI answers are waiting for review.</div>
              ) : (
                candidates.map(cand => (
                  <div key={cand.id} className="candidate-card-item">
                    <span className="badge-cand">
                      Suggested AI answer: {cand.courseId || 'Course knowledge'}
                    </span>
                    <div className="compare-box">
                      <div className="compare-qa"><strong>Question:</strong> {cand.question || 'No question text available.'}</div>
                      <div className="compare-qa teacher-a"><strong>Suggested answer:</strong> {cand.content || cand.answer || 'No answer text available.'}</div>
                    </div>
                    <div className="candidate-actions">
                      <button className="btn-approve-cand" onClick={() => onApproveCandidate(cand.id)}>
                        <CheckCircle style={{ width:12, height:12, display:'inline-block', verticalAlign:'middle' }} /> Approve for AI Tutor
                      </button>
                      <button className="btn-reject-cand" onClick={() => onRejectCandidate(cand.id)}>
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default TeacherPortal;
