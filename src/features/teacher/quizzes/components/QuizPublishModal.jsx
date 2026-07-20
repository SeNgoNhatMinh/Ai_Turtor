import { Alert, Button, Checkbox, Input, Modal, Select, Space, Tag, Typography } from 'antd';
import { getPersonDisplayName, getPersonEmail, getPersonId } from '../../../../utils/displayNames';

const { Text } = Typography;

export default function QuizPublishModal({
  open,
  draft,
  courseId,
  classId,
  publishing,
  target,
  selectedStudents,
  students,
  visibleStudents,
  studentsLoading,
  visibleStudentIds,
  allVisibleSelected,
  keyword,
  onCancel,
  onConfirm,
  onTargetChange,
  onKeywordChange,
  onToggleStudent,
  onToggleVisible,
}) {
  return (
    <Modal
      className="quiz-publish-modal"
      title="Xuất bản quiz"
      open={open}
      onCancel={onCancel}
      onOk={onConfirm}
      confirmLoading={publishing}
      okText="Xuất bản"
      width={620}
      okButtonProps={{ disabled: publishing || (target === 'SELECTED_STUDENTS' && selectedStudents.length === 0) }}
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <div className="quiz-publish-scope">
          <div>
            <Text strong>{draft?.title || 'Quiz chưa đặt tên'}</Text>
            <Text type="secondary">Đáp án đã lưu sẽ là answer key chính thức. Quiz không thể chỉnh sửa sau khi xuất bản.</Text>
          </div>
          <Space wrap size={6}>
            <Tag color="orange">{draft?.courseId || courseId}</Tag>
            <Tag>{draft?.classId || classId}</Tag>
          </Space>
        </div>
        <Select
          value={target}
          onChange={onTargetChange}
          style={{ width: '100%' }}
          options={[
            { value: 'CLASS', label: 'Cả lớp' },
            { value: 'SELECTED_STUDENTS', label: 'Sinh viên được chọn' },
          ]}
        />
        {target === 'SELECTED_STUDENTS' && (
          <div className="quiz-student-picker">
            <div className="quiz-student-picker-header">
              <div>
                <Text strong>Chọn sinh viên theo tên</Text>
                <Text type="secondary">Đã chọn {selectedStudents.length}/{students.length}</Text>
              </div>
              <Button
                size="small"
                disabled={studentsLoading || visibleStudentIds.length === 0}
                onClick={onToggleVisible}
              >
                {allVisibleSelected ? 'Bỏ chọn kết quả đang hiện' : 'Chọn kết quả đang hiện'}
              </Button>
            </div>
            <Input.Search
              allowClear
              value={keyword}
              onChange={(event) => onKeywordChange(event.target.value)}
              placeholder="Tìm theo tên hoặc email"
            />
            {studentsLoading ? (
              <div className="quiz-student-picker-empty">Đang tải danh sách lớp...</div>
            ) : visibleStudents.length === 0 ? (
              <Alert
                type="warning"
                showIcon
                title={keyword ? 'Không có sinh viên phù hợp' : 'Lớp chưa có sinh viên'}
                description="Kiểm tra lớp đã chọn và dữ liệu ghi danh trước khi xuất bản."
              />
            ) : (
              <div className="quiz-student-picker-list">
                {visibleStudents.map((student) => {
                  const studentId = getPersonId(student);
                  const studentName = getPersonDisplayName(student, 'Sinh viên');
                  const studentEmail = getPersonEmail(student);
                  return (
                    <label key={studentId} className="quiz-student-picker-item">
                      <Checkbox
                        checked={selectedStudents.includes(studentId)}
                        onChange={(event) => onToggleStudent(studentId, event.target.checked)}
                      />
                      <span>
                        <strong>{studentName}</strong>
                        <small>{studentEmail || 'Chưa có email'}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Space>
    </Modal>
  );
}
