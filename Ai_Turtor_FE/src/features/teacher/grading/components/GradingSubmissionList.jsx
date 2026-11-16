import { Pagination, Select } from 'antd';
import { getPersonDisplayName } from '../../../../utils/displayNames';

function formatSubmittedDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

function getSubmissionStatusLabel(submission) {
  if (submission.teacherReviewStatus === 'REVIEWED') {
    return `Điểm cuối: ${submission.finalScore}/${submission.maxScore}`;
  }
  if (submission.autoScore == null && submission.score == null) return 'Chờ giảng viên chấm';
  return `Điểm backend: ${submission.autoScore ?? submission.score}/${submission.maxScore}`;
}

export default function GradingSubmissionList({
  submissions,
  selectedSubmission,
  onSelectSubmission,
  quizAttemptPage,
  quizPage,
  onQuizPageChange,
  quizReviewStatus,
  onQuizReviewStatusChange,
  quizLoading,
  loadingQuizDetailId,
}) {
  return (
    <div className="glass-card">
      <div className="card-header" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <span className="grading-tab-button is-active">Quiz trực tuyến</span>
        <Select
          size="small"
          value={quizReviewStatus}
          aria-label="Lọc bài quiz theo trạng thái duyệt"
          onChange={onQuizReviewStatusChange}
          disabled={!onQuizReviewStatusChange || quizLoading}
          options={[
            { value: 'PENDING', label: 'Chờ duyệt' },
            { value: 'REVIEWED', label: 'Đã duyệt' },
            { value: '', label: 'Tất cả bài làm' },
          ]}
          style={{ minWidth: 140, marginLeft: 'auto' }}
        />
      </div>
      <div className="submissions-list-container">
        {quizLoading && (
          <p className="no-data-text">Đang tải bài làm quiz...</p>
        )}
        {!quizLoading && submissions.map((submission) => (
          <button
            type="button"
            key={submission.id}
            className={`submission-item-row ${selectedSubmission?.id === submission.id ? 'selected' : ''}`}
            onClick={() => onSelectSubmission?.(submission)}
            disabled={!onSelectSubmission || loadingQuizDetailId === submission.id}
            aria-pressed={selectedSubmission?.id === submission.id}
          >
            <div className="sub-meta">
              <span className="sub-student">{getPersonDisplayName(submission, 'Sinh viên')}</span>
              <span className="sub-time">{formatSubmittedDate(submission.submittedAt)}</span>
            </div>
            <h5>{submission.title || submission.topic || 'Bài nộp'}</h5>
            <span className={`sub-status ${submission.teacherReviewStatus || submission.status}`}>
              {getSubmissionStatusLabel(submission)}
            </span>
          </button>
        ))}
        {!quizLoading && submissions.length === 0 && (
          <p style={{ padding: '1rem', opacity: 0.7 }}>Không có bài nộp phù hợp.</p>
        )}
        {Number(quizAttemptPage.totalElements || 0) > 0 && (
          <div style={{ padding: '12px 8px 4px', display: 'flex', justifyContent: 'center' }}>
            <Pagination
              simple
              current={quizPage + 1}
              pageSize={quizAttemptPage.size || 20}
              total={quizAttemptPage.totalElements || 0}
              showSizeChanger={false}
              onChange={(page) => onQuizPageChange?.(page - 1)}
              disabled={!onQuizPageChange || quizLoading}
            />
          </div>
        )}
      </div>
    </div>
  );
}
