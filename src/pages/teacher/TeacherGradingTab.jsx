import { useState } from 'react';
import { Download, CheckCircle, XCircle } from 'lucide-react';

function TeacherGradingTab({
  teacherSubmissions = [],
  quizSubmissions = [],
  selectedTeacherSub,
  setSelectedTeacherSub,
  teacherGradeScore,
  setTeacherGradeScore,
  teacherGradeFeedback,
  setTeacherGradeFeedback,
  teacherGradeWeakTopics,
  setTeacherGradeWeakTopics,
  onGradeSubmit,
  handleTeacherQuizReview,
  handleDownloadSubmission,
}) {
  const [activeTab, setActiveTab] = useState('assignments'); // 'assignments' or 'quizzes'

  const handleQuizGradeSubmit = (e) => {
    e.preventDefault();
    handleTeacherQuizReview(selectedTeacherSub.id, teacherGradeScore, teacherGradeFeedback).then(() => {
      setTeacherGradeScore('');
      setTeacherGradeFeedback('');
    });
  };

  const currentList = activeTab === 'assignments' ? teacherSubmissions : quizSubmissions;

  return (
    <div className="grid-2-cols portal-view">
      <div className="glass-card">
        <div className="card-header" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <h3
            style={{ cursor: 'pointer', opacity: activeTab === 'assignments' ? 1 : 0.5 }}
            onClick={() => { setActiveTab('assignments'); setSelectedTeacherSub(null); }}
          >
            File Assignments
          </h3>
          <h3
            style={{ cursor: 'pointer', opacity: activeTab === 'quizzes' ? 1 : 0.5 }}
            onClick={() => { setActiveTab('quizzes'); setSelectedTeacherSub(null); }}
          >
            AI Quizzes
          </h3>
        </div>
        <div className="submissions-list-container">
          {currentList.map((sub) => (
            <div
              key={sub.id}
              className={`submission-item-row ${selectedTeacherSub?.id === sub.id ? 'selected' : ''}`}
              onClick={() => {
                setSelectedTeacherSub(sub);
                setTeacherGradeScore(activeTab === 'assignments' ? (sub.score || '') : (sub.teacherReviewedScore ?? sub.score ?? ''));
                setTeacherGradeFeedback(activeTab === 'assignments' ? (sub.teacherFeedback || '') : (sub.teacherFeedback || ''));
                if (activeTab === 'assignments') {
                  setTeacherGradeWeakTopics(sub.weakTopics || []);
                }
              }}
            >
              <div className="sub-meta">
                <span className="sub-student">{sub.studentName || sub.student || sub.studentId}</span>
                <span className="sub-time">
                  {new Date(sub.submittedAt).toLocaleDateString()}
                </span>
              </div>
              <h5>{sub.title || sub.topic || 'Submission'}</h5>
              <span className={`sub-status ${activeTab === 'assignments' ? sub.status : sub.teacherReviewStatus || sub.status}`}>
                {activeTab === 'assignments'
                  ? (sub.status === 'REVIEWED' ? `Graded: ${sub.score}` : 'Pending grading')
                  : (sub.teacherReviewStatus === 'REVIEWED' ? `Teacher Graded: ${sub.teacherReviewedScore}` : `AI Graded: ${sub.score}/${sub.maxScore}`)}
              </span>
            </div>
          ))}
          {currentList.length === 0 && (
            <p style={{ padding: '1rem', opacity: 0.7 }}>No submissions found.</p>
          )}
        </div>
      </div>

      {selectedTeacherSub && activeTab === 'assignments' && (
        <div className="glass-card">
          <div className="card-header"><h3>Grade Assignment</h3></div>
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
              <div className="input-group">
                <label>Weak Topics (comma separated)</label>
                <input 
                  type="text" 
                  className="glass-input-field" 
                  value={teacherGradeWeakTopics ? teacherGradeWeakTopics.join(', ') : ''} 
                  onChange={(e) => setTeacherGradeWeakTopics(e.target.value.split(',').map(t => t.trim()).filter(Boolean))} 
                  placeholder="e.g. Arrays, For Loops"
                />
              </div>
              <button type="submit" className="btn-submit-form">Save Feedback</button>
              <button type="button" className="btn-small-chat" onClick={() => handleDownloadSubmission(selectedTeacherSub.id)} style={{ marginTop: '0.5rem' }}>
                <Download style={{ width: 12, height: 12 }} /> Download file
              </button>
            </form>
          </div>
        </div>
      )}

      {selectedTeacherSub && activeTab === 'quizzes' && (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <h3>Review Quiz Result</h3>
            <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>
              AI Score: {selectedTeacherSub.score} / {selectedTeacherSub.maxScore} ({selectedTeacherSub.percentage}%)
            </span>
          </div>
          <div className="grading-panel-body" style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
            {selectedTeacherSub.questions?.map((q, idx) => {
              const studentAnswer = selectedTeacherSub.answers?.find(a => a.questionId === q.questionId);
              const isCorrect = studentAnswer?.correct;
              return (
                <div key={q.questionId || idx} style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                  <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Q{idx + 1}: {q.questionText}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.9, fontSize: '0.9rem' }}>
                    <span style={{ color: isCorrect ? '#4ade80' : '#f87171', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      {isCorrect ? <CheckCircle size={14} /> : <XCircle size={14} />}
                      Student chose: {studentAnswer?.selectedAnswer || '(No answer)'}
                    </span>
                  </div>
                  {!isCorrect && (
                    <div style={{ marginTop: '0.5rem', color: '#4ade80', fontSize: '0.9rem' }}>
                      Correct answer: {q.correctAnswer}
                    </div>
                  )}
                  {q.explanation && (
                    <p style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '0.5rem', fontStyle: 'italic' }}>
                      Expl: {q.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="grading-panel-body" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
            <form className="portal-form" onSubmit={handleQuizGradeSubmit}>
              <div className="input-group">
                <label>Override Score (Max: {selectedTeacherSub.maxScore})</label>
                <input 
                  type="number" 
                  step="1" 
                  min="0" 
                  max={selectedTeacherSub.maxScore} 
                  className="glass-input-field" 
                  value={teacherGradeScore} 
                  onChange={(e) => setTeacherGradeScore(e.target.value)} 
                  required 
                />
              </div>
              <div className="input-group">
                <label>Teacher Feedback</label>
                <textarea 
                  value={teacherGradeFeedback} 
                  onChange={(e) => setTeacherGradeFeedback(e.target.value)} 
                  required 
                  placeholder="Optional feedback..."
                />
              </div>
              <button type="submit" className="btn-submit-form">Submit Review</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeacherGradingTab;
