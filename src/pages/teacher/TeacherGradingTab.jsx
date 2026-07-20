import { useState } from 'react';
import { Download, CheckCircle, Sparkles, Upload, XCircle } from 'lucide-react';
import { Alert, Button, Pagination, Select, Space, Tag } from 'antd';
import { getPersonDisplayName } from '../../utils/displayNames';
import { getQuizReviewDetails } from '../../features/student/quizzes/quizQuestionUtils';
import '../student/Quiz.css';
import { ANSWER_KEY_FILE_ACCEPT } from '../../utils/assignmentFiles';

const formatReviewTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
};

function TeacherGradingTab({
  teacherSubmissions = [],
  quizSubmissions = [],
  quizAttemptPage = {},
  quizPage = 0,
  onQuizPageChange,
  quizReviewStatus = 'PENDING',
  onQuizReviewStatusChange,
  isQuizSubmissionsLoading = false,
  loadingQuizDetailId = '',
  selectedTeacherSub,
  setSelectedTeacherSub,
  onSelectSubmission,
  teacherGradeScore,
  setTeacherGradeScore,
  teacherGradeFeedback,
  setTeacherGradeFeedback,
  teacherGradeWeakTopics,
  setTeacherGradeWeakTopics,
  onGradeSubmit,
  handleTeacherQuizReview,
  handleDownloadSubmission,
  answerKeyUploadingId = '',
  aiGradingSubmissionId = '',
  gradingMutationKeys = [],
  handleUploadAnswerKey,
  handleAiGradeSubmission,
}) {
  const [activeTab, setActiveTab] = useState('assignments'); // 'assignments' or 'quizzes'
  const [answerKeySelection, setAnswerKeySelection] = useState(null);
  const answerKeyFile = answerKeySelection
    && answerKeySelection.assignmentId === selectedTeacherSub?.assignmentId
    ? answerKeySelection.file
    : null;

  const handleQuizGradeSubmit = async (e) => {
    e.preventDefault();
    if (!handleTeacherQuizReview || isQuizReviewSubmitting || String(selectedTeacherSub?.teacherReviewStatus || '').toUpperCase() === 'REVIEWED') return;
    await handleTeacherQuizReview(selectedTeacherSub.id, teacherGradeScore, teacherGradeFeedback);
  };

  const currentList = activeTab === 'assignments' ? teacherSubmissions : quizSubmissions;
  const selectedSubmissionId = selectedTeacherSub?.submissionId || selectedTeacherSub?.id || '';
  const isAssignmentReviewSubmitting = gradingMutationKeys.includes(`assignment-review:${selectedSubmissionId}`);
  const isQuizReviewSubmitting = gradingMutationKeys.includes(`quiz-review:${selectedTeacherSub?.id || ''}`);

  return (
    <div className="grid-2-cols portal-view">
      <div className="glass-card">
        <div className="card-header" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            type="button"
            className={`grading-tab-button ${activeTab === 'assignments' ? 'is-active' : ''}`}
            onClick={() => { setActiveTab('assignments'); setSelectedTeacherSub(null); }}
            aria-pressed={activeTab === 'assignments'}
          >
            File Assignments
          </button>
          <button
            type="button"
            className={`grading-tab-button ${activeTab === 'quizzes' ? 'is-active' : ''}`}
            onClick={() => { setActiveTab('quizzes'); setSelectedTeacherSub(null); }}
            aria-pressed={activeTab === 'quizzes'}
          >
            Online Quizzes
          </button>
          {activeTab === 'quizzes' && (
            <Select
              size="small"
              value={quizReviewStatus}
              aria-label="Filter quiz attempts by review status"
              onChange={onQuizReviewStatusChange}
              disabled={!onQuizReviewStatusChange || isQuizSubmissionsLoading}
              options={[
                { value: 'PENDING', label: 'Pending review' },
                { value: 'REVIEWED', label: 'Reviewed' },
                { value: '', label: 'All attempts' },
              ]}
              style={{ minWidth: 140, marginLeft: 'auto' }}
            />
          )}
        </div>
        <div className="submissions-list-container">
          {activeTab === 'quizzes' && isQuizSubmissionsLoading && (
            <p className="no-data-text">Loading quiz attempts...</p>
          )}
          {!isQuizSubmissionsLoading && currentList.map((sub) => (
            <button
              type="button"
              key={sub.id}
              className={`submission-item-row ${selectedTeacherSub?.id === sub.id ? 'selected' : ''}`}
              onClick={() => onSelectSubmission(sub, activeTab)}
              disabled={!onSelectSubmission || loadingQuizDetailId === sub.id}
              aria-pressed={selectedTeacherSub?.id === sub.id}
            >
              <div className="sub-meta">
                <span className="sub-student">{getPersonDisplayName(sub, 'Student')}</span>
                <span className="sub-time">
                  {new Date(sub.submittedAt).toLocaleDateString()}
                </span>
              </div>
              <h5>{sub.title || sub.topic || 'Submission'}</h5>
              <span className={`sub-status ${activeTab === 'assignments' ? sub.status : sub.teacherReviewStatus || sub.status}`}>
                {activeTab === 'assignments'
                  ? (sub.status === 'REVIEWED'
                    ? `Final score: ${sub.score}/${sub.maxScore ?? 10}`
                    : sub.aiGradingStatus === 'PROCESSING'
                      ? 'AI grading in progress'
                      : sub.aiGradingStatus === 'SUGGESTED'
                        ? `AI suggestion: ${sub.aiSuggestedScore}/${sub.maxScore ?? 10}`
                        : 'Pending grading')
                  : (sub.teacherReviewStatus === 'REVIEWED'
                    ? `Final score: ${sub.finalScore}/${sub.maxScore}`
                    : sub.autoScore == null && sub.score == null
                      ? 'Waiting for teacher grading'
                      : `Auto score: ${sub.autoScore ?? sub.score}/${sub.maxScore}`)}
              </span>
            </button>
          ))}
          {!isQuizSubmissionsLoading && currentList.length === 0 && (
            <p style={{ padding: '1rem', opacity: 0.7 }}>No submissions found.</p>
          )}
          {activeTab === 'quizzes' && Number(quizAttemptPage.totalElements || 0) > 0 && (
            <div style={{ padding: '12px 8px 4px', display: 'flex', justifyContent: 'center' }}>
              <Pagination
                simple
                current={quizPage + 1}
                pageSize={quizAttemptPage.size || 20}
                total={quizAttemptPage.totalElements || 0}
                showSizeChanger={false}
                onChange={(page) => onQuizPageChange?.(page - 1)}
                disabled={!onQuizPageChange || isQuizSubmissionsLoading}
              />
            </div>
          )}
        </div>
      </div>

      {selectedTeacherSub && activeTab === 'assignments' && (
        <div className="glass-card">
          <div className="card-header">
            <h3>Grade File Assignment</h3>
            <Space wrap>
              <Tag>{selectedTeacherSub.assignmentType || 'ASSIGNMENT'}</Tag>
              <Tag color="blue">Max score: {selectedTeacherSub.maxScore ?? 10}</Tag>
            </Space>
          </div>
          <div className="grading-panel-body">
            <Alert
              type="info"
              showIcon
              title="Optional AI-assisted grading"
              description="Upload a private answer key, then ask AI for a score suggestion. The suggestion never becomes the final score until you save it below."
              style={{ marginBottom: 16 }}
            />
            <div className="portal-form" style={{ marginBottom: 20 }}>
              <div className="input-group">
                <label>Private answer key (DOCX, PDF or TXT)</label>
                <input
                  type="file"
                  accept={ANSWER_KEY_FILE_ACCEPT}
                  className="glass-input-field"
                  onChange={(event) => setAnswerKeySelection({
                    assignmentId: selectedTeacherSub.assignmentId,
                    file: event.target.files?.[0] || null,
                  })}
                />
              </div>
              <Space wrap>
                <Button
                  icon={<Upload size={14} />}
                  loading={answerKeyUploadingId === selectedTeacherSub.assignmentId}
                  disabled={!answerKeyFile || !selectedTeacherSub.assignmentId || !handleUploadAnswerKey}
                  onClick={async () => {
                    const succeeded = await handleUploadAnswerKey?.(selectedTeacherSub.assignmentId, answerKeyFile);
                    if (succeeded) setAnswerKeySelection(null);
                  }}
                >
                  {selectedTeacherSub.answerKeyUploaded ? 'Replace answer key' : 'Upload answer key'}
                </Button>
                <Button
                  type="primary"
                  icon={<Sparkles size={14} />}
                  loading={aiGradingSubmissionId === selectedTeacherSub.id || selectedTeacherSub.aiGradingStatus === 'PROCESSING'}
                  disabled={!selectedTeacherSub.answerKeyUploaded || selectedTeacherSub.status === 'REVIEWED' || !handleAiGradeSubmission}
                  onClick={() => handleAiGradeSubmission(selectedTeacherSub)}
                >
                  Generate AI suggestion
                </Button>
                {selectedTeacherSub.answerKeyUploaded && <Tag color="green">Answer key ready</Tag>}
              </Space>
              {selectedTeacherSub.aiGradingStatus === 'SUGGESTED' && (
                <Alert
                  type="success"
                  showIcon
                  title={`AI suggested ${selectedTeacherSub.aiSuggestedScore}/${selectedTeacherSub.maxScore ?? 10}`}
                  description={selectedTeacherSub.aiFeedback || 'Review the suggestion and confirm the final score below.'}
                  action={(
                    <Button
                      size="small"
                      onClick={() => {
                        setTeacherGradeScore(String(selectedTeacherSub.aiSuggestedScore ?? ''));
                        if (!teacherGradeFeedback && selectedTeacherSub.aiFeedback) {
                          setTeacherGradeFeedback(selectedTeacherSub.aiFeedback);
                        }
                      }}
                    >
                      Use suggestion
                    </Button>
                  )}
                  style={{ marginTop: 12 }}
                />
              )}
              {selectedTeacherSub.aiGradingStatus === 'FAILED' && (
                <Alert type="error" showIcon title="AI grading failed" description={selectedTeacherSub.aiFeedback || 'You can still grade this submission manually.'} style={{ marginTop: 12 }} />
              )}
            </div>
            <form className="portal-form" onSubmit={onGradeSubmit || ((event) => event.preventDefault())}>
              <div className="input-group">
                <label>Final score (Max: {selectedTeacherSub.maxScore ?? 10})</label>
                <input type="number" step="0.1" min="0" max={selectedTeacherSub.maxScore ?? 10} className="glass-input-field" value={teacherGradeScore} onChange={(e) => setTeacherGradeScore(e.target.value)} required disabled={isAssignmentReviewSubmitting} />
              </div>
              <div className="input-group">
                <label>Detailed feedback</label>
                <textarea value={teacherGradeFeedback} onChange={(e) => setTeacherGradeFeedback(e.target.value)} placeholder="Optional feedback for the student" disabled={isAssignmentReviewSubmitting} />
              </div>
              <div className="input-group">
                <label>Weak Topics (comma separated)</label>
                <input 
                  type="text" 
                  className="glass-input-field" 
                  value={teacherGradeWeakTopics ? teacherGradeWeakTopics.join(', ') : ''} 
                  onChange={(e) => setTeacherGradeWeakTopics(e.target.value.split(',').map(t => t.trim()).filter(Boolean))} 
                  placeholder="e.g. Arrays, For Loops"
                  disabled={isAssignmentReviewSubmitting}
                />
              </div>
              <button type="submit" className="btn-submit-form" disabled={isAssignmentReviewSubmitting || !onGradeSubmit}>
                {isAssignmentReviewSubmitting ? 'Saving final score...' : 'Save final score'}
              </button>
              <button type="button" className="btn-small-chat" disabled={!handleDownloadSubmission} onClick={() => handleDownloadSubmission(selectedTeacherSub)} style={{ marginTop: '0.5rem' }}>
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
            <div className="quiz-grading-score-summary">
              {String(selectedTeacherSub.gradingMode || '').toUpperCase() === 'TEACHER_MANUAL'
                && selectedTeacherSub.autoScore === null
                && selectedTeacherSub.score === null ? (
                <Tag color="blue">Teacher manual: score pending</Tag>
              ) : (
                <Tag>Auto score: {selectedTeacherSub.autoScore ?? selectedTeacherSub.score} / {selectedTeacherSub.maxScore}</Tag>
              )}
              {String(selectedTeacherSub.teacherReviewStatus || '').toUpperCase() === 'REVIEWED' && (
                <Tag color="green">Final score: {selectedTeacherSub.teacherReviewedScore ?? selectedTeacherSub.finalScore} / {selectedTeacherSub.maxScore}</Tag>
              )}
            </div>
          </div>
          <div className="grading-panel-body" style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
            {loadingQuizDetailId === selectedTeacherSub.id && (
              <p className="no-data-text">Loading quiz questions and answers...</p>
            )}
            {loadingQuizDetailId !== selectedTeacherSub.id && selectedTeacherSub.questions?.length === 0 && (
              <p className="no-data-text">No question details are available for this attempt.</p>
            )}
            {selectedTeacherSub.questions?.map((q, idx) => {
              const studentAnswer = selectedTeacherSub.answers?.find(a => a.questionId === q.questionId);
              const review = getQuizReviewDetails(q, studentAnswer);
              const canShowAnswerKey = Boolean(review.correctAnswer)
                && (String(selectedTeacherSub.gradingMode || '').toUpperCase() !== 'TEACHER_MANUAL'
                  || String(selectedTeacherSub.teacherReviewStatus || '').toUpperCase() === 'REVIEWED');
              return (
                <div key={q.questionId || idx} className="quiz-review-item quiz-teacher-review-item">
                  <div className="quiz-review-question-heading">
                    <div className="quiz-review-question">
                      <strong>Question {idx + 1}</strong>
                      <span>{q.questionText}</span>
                    </div>
                    {canShowAnswerKey && (
                      <Tag color={review.isCorrect ? 'green' : 'red'} icon={review.isCorrect ? <CheckCircle size={13} /> : <XCircle size={13} />}>
                        {review.isCorrect ? 'Correct' : 'Incorrect'}
                      </Tag>
                    )}
                  </div>
                  <div className="quiz-review-answer-grid">
                    <span className="quiz-review-options-label">Answer choices</span>
                    <ul className="quiz-review-options">
                      {review.choices.map((choice, optionIndex) => {
                        const stateClass = canShowAnswerKey && choice.isCorrectAnswer
                          ? 'quiz-review-option--correct'
                          : canShowAnswerKey && choice.isSelected
                            ? 'quiz-review-option--incorrect'
                            : '';
                        return (
                          <li key={`${q.questionId || idx}-${choice.value}-${optionIndex}`} className={`quiz-review-option ${stateClass}`}>
                            <span className="quiz-review-option-marker">{String.fromCharCode(65 + optionIndex)}</span>
                            <span className="quiz-review-option-text">{choice.text}</span>
                            <span className="quiz-review-option-tags">
                              {choice.isSelected && <Tag color={canShowAnswerKey ? (review.isCorrect ? 'green' : 'red') : 'blue'}>Student choice</Tag>}
                              {canShowAnswerKey && choice.isCorrectAnswer && <Tag color="green">Correct answer</Tag>}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {!review.selectedAnswer && <span className="quiz-review-unanswered">Student did not answer this question.</span>}
                    {canShowAnswerKey && review.explanation && (
                      <div className="quiz-review-explanation">
                        <strong>Explanation</strong>
                        <span>{review.explanation}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {String(selectedTeacherSub.teacherReviewStatus || '').toUpperCase() === 'REVIEWED' ? (
            <div className="grading-panel-body quiz-final-review-summary">
              <Alert
                type="success"
                showIcon
                title="Teacher review completed"
                description={(
                  <div>
                    <p>Final score: <strong>{selectedTeacherSub.teacherReviewedScore ?? selectedTeacherSub.finalScore} / {selectedTeacherSub.maxScore}</strong></p>
                    {selectedTeacherSub.teacherFeedback && <p>Feedback: {selectedTeacherSub.teacherFeedback}</p>}
                    {formatReviewTime(selectedTeacherSub.teacherReviewedAt) && <p>Reviewed: {formatReviewTime(selectedTeacherSub.teacherReviewedAt)}</p>}
                  </div>
                )}
              />
            </div>
          ) : (
            <div className="grading-panel-body quiz-final-review-form">
              <Alert
                type="info"
                showIcon
                title="Confirm the final score"
                description="The backend calculated the auto score from the published answer key. Your review changes the final total score and feedback; it does not rewrite individual answers."
              />
              <form className="portal-form" onSubmit={handleQuizGradeSubmit}>
                <div className="input-group">
                  <label htmlFor="teacher-quiz-final-score">Final Score (Max: {selectedTeacherSub.maxScore})</label>
                  <input
                    id="teacher-quiz-final-score"
                    aria-label="Final score"
                    type="number"
                    step="1"
                    min="0"
                    max={selectedTeacherSub.maxScore}
                    className="glass-input-field"
                    value={teacherGradeScore}
                    onChange={(e) => setTeacherGradeScore(e.target.value)}
                    required
                    disabled={isQuizReviewSubmitting}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="teacher-quiz-final-feedback">Teacher Feedback</label>
                  <textarea
                    id="teacher-quiz-final-feedback"
                    aria-label="Teacher feedback"
                    value={teacherGradeFeedback}
                    onChange={(e) => setTeacherGradeFeedback(e.target.value)}
                    required
                    placeholder="Explain the final score or give the student learning guidance."
                    disabled={isQuizReviewSubmitting}
                  />
                </div>
                <button type="submit" className="btn-submit-form" disabled={isQuizReviewSubmitting || !handleTeacherQuizReview}>
                  {isQuizReviewSubmitting ? 'Submitting final review...' : 'Submit Final Review'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TeacherGradingTab;
