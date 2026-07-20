import { DownloadOutlined, FileTextOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Input, message, Space, Typography, Upload } from 'antd';
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

  return (
    <Card
      title={assignment ? `Chi tiết: ${assignment.title}` : 'Chi tiết bài tập'}
      className="materials-detail-card"
      extra={deadline ? <Text type="secondary">{new Date(deadline).toLocaleString()}</Text> : null}
    >
      {!assignment ? (
        <Empty description={uiCopy.student.materials.empty} />
      ) : (
        <>
          <Paragraph>{assignment.description || assignment.desc || 'Bài tập chưa có mô tả.'}</Paragraph>
          <div className="assignment-attachment">
            <Space>
              <FileTextOutlined style={{ fontSize: 24, color: '#F37021' }} />
              <div>
                <Text strong>{getAssignmentFileName(assignment)}</Text>
                <br />
                {hasAssignmentAttachment(assignment) && onDownloadAssignment ? (
                  <Button
                    type="link"
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={() => onDownloadAssignment(assignment)}
                    style={{ padding: 0 }}
                  >
                    Tải đề bài
                  </Button>
                ) : (
                  <Text type="secondary">Không có tệp để tải xuống</Text>
                )}
              </div>
            </Space>
          </div>

          {assignment.submission && (
            <Card size="small" title="Bài đã nộp" style={{ marginBottom: 16 }}>
              <Space orientation="vertical" size={4}>
                <Text>Trạng thái: {String(assignment.submission.status || 'SUBMITTED').replaceAll('_', ' ')}</Text>
                {assignment.submission.score != null && (
                  <Text strong>Điểm: {assignment.submission.score}/{assignment.maxScore ?? 10}</Text>
                )}
                {assignment.submission.teacherFeedback && (
                  <Paragraph style={{ margin: 0 }}>
                    Nhận xét của giảng viên: {assignment.submission.teacherFeedback}
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
            </Card>
          )}

          <Title level={5}>Nộp bài</Title>
          <Dragger
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
            style={{ marginBottom: 16 }}
          >
            <p className="ant-upload-drag-icon"><UploadOutlined /></p>
            <p className="ant-upload-text">{uiCopy.student.materials.uploadText}</p>
            <p className="ant-upload-hint">{uiCopy.student.materials.uploadHint}</p>
          </Dragger>

          <TextArea
            rows={3}
            placeholder="Thêm ghi chú cho giảng viên..."
            value={submissionNote}
            onChange={(event) => setSubmissionNote(event.target.value)}
            style={{ marginBottom: 16 }}
          />
          <Button
            type="primary"
            block
            loading={isSubmitting}
            disabled={!submissionFile || isSubmitting || !onSubmit}
            onClick={onSubmit}
          >
            {assignment.submission ? 'Nộp phiên bản mới' : 'Nộp bài tập'}
          </Button>
        </>
      )}
    </Card>
  );
}
