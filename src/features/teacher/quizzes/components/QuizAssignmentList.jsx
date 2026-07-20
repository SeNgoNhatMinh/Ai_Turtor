import { Button, Card, Empty, Space, Tag, Tooltip, Typography } from 'antd';
import {
  getQuizAssignmentId,
  getQuizGradingModeLabel,
  isQuizDraft,
} from '../quizAssignmentUtils';

const { Text } = Typography;

export default function QuizAssignmentList({
  assignments,
  courseId,
  classId,
  activeDraft,
  editorState,
  onEdit,
  onPublish,
  onDelete,
}) {
  return (
    <Card
      className="quiz-card"
      title="Danh sách quiz theo lớp"
      extra={courseId && classId ? <Text type="secondary">{courseId} / {classId}</Text> : null}
    >
      {assignments.length ? (
        <div className="quiz-assignment-list">
          {assignments.map((item) => {
            const draft = isQuizDraft(item);
            const isDirtyActiveDraft = getQuizAssignmentId(activeDraft) === getQuizAssignmentId(item)
              && editorState.dirty;
            return (
              <div key={getQuizAssignmentId(item)} className="quiz-assignment-row">
                <div>
                  <Text strong>{item.title || item.topic || 'Quiz chưa đặt tên'}</Text>
                  <div>
                    <Text type="secondary">
                      {draft ? 'Bản nháp' : item.status} {item.classId ? `- ${item.classId}` : ''}
                    </Text>
                    {item.gradingMode && <Tag style={{ marginLeft: 8 }}>{getQuizGradingModeLabel(item.gradingMode)}</Tag>}
                  </div>
                </div>
                <Space wrap>
                  {draft ? (
                    <>
                      <Button size="small" onClick={() => onEdit(item)}>Chỉnh sửa</Button>
                      <Tooltip title={isDirtyActiveDraft ? 'Lưu draft đang mở trước' : ''}>
                        <span>
                          <Button
                            size="small"
                            type="primary"
                            disabled={isDirtyActiveDraft}
                            onClick={() => onPublish(item)}
                          >
                            Xuất bản
                          </Button>
                        </span>
                      </Tooltip>
                      <Button size="small" danger onClick={() => onDelete(item)}>Xóa</Button>
                    </>
                  ) : (
                    <Space wrap size={6}>
                      <Tag color="green">Đã xuất bản · Chỉ xem</Tag>
                      <Text type="secondary">
                        {item.targetType === 'SELECTED_STUDENTS'
                          ? `${item.targetStudentIds?.length || 0} sinh viên được chọn`
                          : 'Cả lớp'}
                      </Text>
                      <Button size="small" onClick={() => onEdit(item)}>Xem</Button>
                    </Space>
                  )}
                </Space>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={courseId && classId
            ? `Chưa có quiz cho ${courseId} / ${classId}`
            : 'Chọn lớp học phần để xem danh sách quiz'}
        />
      )}
    </Card>
  );
}
