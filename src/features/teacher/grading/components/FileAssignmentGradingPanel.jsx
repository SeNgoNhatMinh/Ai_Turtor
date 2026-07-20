import { useState } from 'react';
import { Download, Sparkles, Upload } from 'lucide-react';
import { Alert, Button, Space, Tag } from 'antd';
import { ANSWER_KEY_FILE_ACCEPT } from '../../../../utils/assignmentFiles';

export default function FileAssignmentGradingPanel({
  submission,
  score,
  setScore,
  feedback,
  setFeedback,
  weakTopics,
  setWeakTopics,
  onGradeSubmit,
  onDownload,
  answerKeyUploadingId,
  aiGradingSubmissionId,
  reviewSubmitting,
  onUploadAnswerKey,
  onAiGrade,
}) {
  const [answerKeySelection, setAnswerKeySelection] = useState(null);
  const answerKeyFile = answerKeySelection
    && answerKeySelection.assignmentId === submission.assignmentId
    ? answerKeySelection.file
    : null;

  return (
    <div className="glass-card">
      <div className="card-header">
        <h3>Chấm bài tập tệp</h3>
        <Space wrap>
          <Tag>{submission.assignmentType || 'ASSIGNMENT'}</Tag>
          <Tag color="blue">Điểm tối đa: {submission.maxScore ?? 10}</Tag>
        </Space>
      </div>
      <div className="grading-panel-body">
        <Alert
          type="info"
          showIcon
          title="AI hỗ trợ chấm (không bắt buộc)"
          description="Tải answer key riêng tư rồi yêu cầu AI đưa điểm gợi ý. Điểm này chỉ trở thành điểm cuối khi giảng viên lưu bên dưới."
          style={{ marginBottom: 16 }}
        />
        <div className="portal-form" style={{ marginBottom: 20 }}>
          <div className="input-group">
            <label>Answer key riêng tư (DOCX, PDF hoặc TXT)</label>
            <input
              type="file"
              accept={ANSWER_KEY_FILE_ACCEPT}
              className="glass-input-field"
              onChange={(event) => setAnswerKeySelection({
                assignmentId: submission.assignmentId,
                file: event.target.files?.[0] || null,
              })}
            />
          </div>
          <Space wrap>
            <Button
              icon={<Upload size={14} />}
              loading={answerKeyUploadingId === submission.assignmentId}
              disabled={!answerKeyFile || !submission.assignmentId || !onUploadAnswerKey}
              onClick={async () => {
                const succeeded = await onUploadAnswerKey?.(submission.assignmentId, answerKeyFile);
                if (succeeded) setAnswerKeySelection(null);
              }}
            >
              {submission.answerKeyUploaded ? 'Thay answer key' : 'Tải answer key'}
            </Button>
            <Button
              type="primary"
              icon={<Sparkles size={14} />}
              loading={aiGradingSubmissionId === submission.id || submission.aiGradingStatus === 'PROCESSING'}
              disabled={!submission.answerKeyUploaded || submission.status === 'REVIEWED' || !onAiGrade}
              onClick={() => onAiGrade(submission)}
            >
              Tạo điểm AI gợi ý
            </Button>
            {submission.answerKeyUploaded && <Tag color="green">Answer key đã sẵn sàng</Tag>}
          </Space>
          {submission.aiGradingStatus === 'SUGGESTED' && (
            <Alert
              type="success"
              showIcon
              title={`AI gợi ý ${submission.aiSuggestedScore}/${submission.maxScore ?? 10}`}
              description={submission.aiFeedback || 'Kiểm tra gợi ý và xác nhận điểm cuối bên dưới.'}
              action={(
                <Button
                  size="small"
                  onClick={() => {
                    setScore(String(submission.aiSuggestedScore ?? ''));
                    if (!feedback && submission.aiFeedback) setFeedback(submission.aiFeedback);
                  }}
                >
                  Dùng điểm gợi ý
                </Button>
              )}
              style={{ marginTop: 12 }}
            />
          )}
          {submission.aiGradingStatus === 'FAILED' && (
            <Alert
              type="error"
              showIcon
              title="AI không thể phân tích bài"
              description={submission.aiFeedback || 'Giảng viên vẫn có thể chấm bài thủ công.'}
              style={{ marginTop: 12 }}
            />
          )}
        </div>
        <form className="portal-form" onSubmit={onGradeSubmit || ((event) => event.preventDefault())}>
          <div className="input-group">
            <label>Điểm cuối (Tối đa: {submission.maxScore ?? 10})</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max={submission.maxScore ?? 10}
              className="glass-input-field"
              value={score}
              onChange={(event) => setScore(event.target.value)}
              required
              disabled={reviewSubmitting}
            />
          </div>
          <div className="input-group">
            <label>Nhận xét chi tiết</label>
            <textarea
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              placeholder="Nhận xét cho sinh viên (không bắt buộc)"
              disabled={reviewSubmitting}
            />
          </div>
          <div className="input-group">
            <label>Chủ đề còn yếu (ngăn cách bằng dấu phẩy)</label>
            <input
              type="text"
              className="glass-input-field"
              value={weakTopics ? weakTopics.join(', ') : ''}
              onChange={(event) => setWeakTopics(event.target.value.split(',').map((topic) => topic.trim()).filter(Boolean))}
              placeholder="Ví dụ: Mảng, vòng lặp for"
              disabled={reviewSubmitting}
            />
          </div>
          <button type="submit" className="btn-submit-form" disabled={reviewSubmitting || !onGradeSubmit}>
            {reviewSubmitting ? 'Đang lưu điểm...' : 'Lưu điểm cuối'}
          </button>
          <button
            type="button"
            className="btn-small-chat"
            disabled={!onDownload}
            onClick={() => onDownload(submission)}
            style={{ marginTop: '0.5rem' }}
          >
            <Download style={{ width: 12, height: 12 }} /> Tải bài nộp
          </button>
        </form>
      </div>
    </div>
  );
}
