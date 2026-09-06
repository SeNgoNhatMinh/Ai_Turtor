import {
  CalendarOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  FileTextOutlined,
  FormOutlined,
  SendOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { Button, Card, Empty, Input, message, Space, Tag, Typography, Upload } from 'antd';
import StatusLabel from '../../../../components/common/StatusLabel';
import { uiCopy } from '../../../../constants/uiCopy';
import { ASSIGNMENT_FILE_ACCEPT, validateAssignmentFile } from '../../../../utils/assignmentFiles';

const { Paragraph, Text, Title } = Typography;
const { TextArea } = Input;
const { Dragger } = Upload;

const getAssignmentFileName = (assignment) => assignment?.attachmentFileName
  || assignment?.fileName
  || assignment?.originalFileName
  || assignment?.title
  || 'Tệp đính kèm bài tập';

const hasAssignmentAttachment = (assignment) => Boolean(
  assignment?.attachmentFileName
  || assignment?.fileName
  || assignment?.originalFileName
  || assignment?.attachmentUrl
  || assignment?.fileUrl
);

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function AssignmentDetailsPanel({
  assignment,
  submissionFile,
  setSubmissionFile,
  submissionNote,
  setSubmissionNote,
  isSubmitting,
  onSubmit,
  onDownloadAssignment,
  onDownloadSubmission,
}) {
  const deadline = assignment?.dueAt || assignment?.deadline;
  const deadlineLabel = formatDateTime(deadline);
  const submissionStatus = String(
    assignment?.submission?.status || assignment?.status || 'PENDING',
  ).toUpperCase();
  const isExam = String(assignment?.assignmentType || 'ASSIGNMENT').toUpperCase() === 'EXAM';

  return (
    <Card
      className="materials-detail-card"
      styles={{ body: { padding: 0 } }}
    >
      {!assignment ? (
        <Empty
          className="student-assignment-details__empty"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={(
            <span>
              <strong>{uiCopy.student.assignments.empty}</strong>
              <small>Thông tin bài tập và khu vực nộp bài sẽ hiển thị tại đây.</small>
            </span>
          )}
        />
      ) : (
        <>
          <div className="student-assignment-details__header">
            <div className="student-assignment-details__title-row">
              <span className="student-assignment-details__icon" aria-hidden="true">
                <FormOutlined />
              </span>
              <div>
                <span className="student-assignment-details__eyebrow">Chi tiết bài tập</span>
                <h2>{assignment.title || 'Bài tập chưa đặt tên'}</h2>
              </div>
            </div>
            <div className="student-assignment-details__meta">
              <Tag color={isExam ? 'gold' : 'blue'}>{isExam ? 'Bài kiểm tra' : 'Bài tập'}</Tag>
              <StatusLabel status={submissionStatus} />
              {deadlineLabel && (
                <span className="student-assignment-details__deadline">
                  <CalendarOutlined aria-hidden="true" />
                  Hạn nộp {deadlineLabel}
                </span>
              )}
            </div>
          </div>

          <div className="student-assignment-details__content">
            <section className="student-assignment-details__section" aria-labelledby="assignment-requirements-title">
              <h3 id="assignment-requirements-title">Yêu cầu bài tập</h3>
              <Paragraph>{assignment.description || assignment.desc || 'Giảng viên chưa thêm mô tả cho bài tập này.'}</Paragraph>

              <div className="assignment-attachment">
                <span className="assignment-attachment__icon" aria-hidden="true">
                  <FileTextOutlined />
                </span>
                <div className="assignment-attachment__copy">
                  <Text strong>{getAssignmentFileName(assignment)}</Text>
                  <Text type="secondary">
                    {hasAssignmentAttachment(assignment) ? 'Tệp đề bài từ giảng viên' : 'Bài tập không có tệp đính kèm'}
                  </Text>
                </div>
                {hasAssignmentAttachment(assignment) && onDownloadAssignment ? (
                  <Button
                    className="assignment-attachment__action"
                    icon={<DownloadOutlined />}
                    onClick={() => onDownloadAssignment(assignment)}
                  >
                    Tải đề bài
                  </Button>
                ) : null}
              </div>
            </section>

            {assignment.submission && (
              <section className="student-assignment-submitted" aria-labelledby="submitted-assignment-title">
                <div className="student-assignment-submitted__heading">
                  <span className="student-assignment-submitted__icon" aria-hidden="true">
                    <CheckCircleOutlined />
                  </span>
                  <div>
                    <h3 id="submitted-assignment-title">Bài đã nộp</h3>
                    <Text type="secondary">Bài làm gần nhất của bạn đã được ghi nhận.</Text>
                  </div>
                </div>
                <Space orientation="vertical" size={8} className="student-assignment-submitted__body">
                  <StatusLabel status={submissionStatus} />
                  {assignment.submission.score != null && (
                    <Text strong>Điểm: {assignment.submission.score}/{assignment.maxScore ?? 10}</Text>
                  )}
                  {assignment.submission.teacherFeedback && (
                    <Paragraph className="student-assignment-submitted__feedback">
                      <strong>Nhận xét của giảng viên:</strong> {assignment.submission.teacherFeedback}
                    </Paragraph>
                  )}
                  {onDownloadSubmission && (
                    <Button
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={() => onDownloadSubmission(assignment.submission)}
                    >
                      Tải bài đã nộp
                    </Button>
                  )}
                </Space>
              </section>
            )}

            <section className="student-assignment-submit" aria-labelledby="submit-assignment-title">
              <div className="student-assignment-submit__heading">
                <div>
                  <Title level={4} id="submit-assignment-title">
                    {assignment.submission ? 'Nộp phiên bản mới' : 'Nộp bài'}
                  </Title>
                  <Text type="secondary">Chọn tệp bài làm và thêm ghi chú nếu cần.</Text>
                </div>
              </div>

              <Dragger
                className="student-assignment-dropzone"
                accept={ASSIGNMENT_FILE_ACCEPT}
                beforeUpload={(file) => {
                  const validation = validateAssignmentFile(file);
                  if (!validation.ok) {
                    message.error(validation.message);
                    return Upload.LIST_IGNORE;
                  }
                  setSubmissionFile(file);
                  return false;
                }}
                fileList={submissionFile ? [submissionFile] : []}
                onRemove={() => setSubmissionFile(null)}
              >
                <p className="ant-upload-drag-icon"><UploadOutlined /></p>
                <p className="ant-upload-text">{uiCopy.student.assignments.uploadText}</p>
                <p className="ant-upload-hint">{uiCopy.student.assignments.uploadHint}</p>
              </Dragger>

              <label className="student-assignment-submit__note">
                <Text strong>Ghi chú cho giảng viên</Text>
                <TextArea
                  rows={3}
                  placeholder="Ví dụ: Em gửi kèm mã nguồn và báo cáo..."
                  value={submissionNote}
                  onChange={(event) => setSubmissionNote(event.target.value)}
                />
              </label>
              <Button
                className="student-assignment-submit__button"
                type="primary"
                size="large"
                block
                icon={<SendOutlined />}
                loading={isSubmitting}
                disabled={!submissionFile || isSubmitting || !onSubmit}
                onClick={onSubmit}
              >
                {assignment.submission ? 'Nộp phiên bản mới' : 'Nộp bài tập'}
              </Button>
            </section>
          </div>
        </>
      )}
    </Card>
  );
}
