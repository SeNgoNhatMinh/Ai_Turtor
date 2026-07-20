import { Modal, Typography } from 'antd';

const { Text } = Typography;

export default function QuizClassSwitchModal({ pendingClass, onCancel, onConfirm }) {
  return (
    <Modal
      title="Đổi lớp học phần?"
      open={Boolean(pendingClass)}
      onCancel={onCancel}
      onOk={() => pendingClass && onConfirm(pendingClass.classId)}
      okText="Đổi lớp"
      cancelText="Tiếp tục chỉnh sửa"
    >
      <Text>
        Draft hiện tại có thay đổi chưa lưu. Nếu đổi sang{' '}
        <Text strong>
          {pendingClass?.courseId || 'Môn học'} / {pendingClass?.classId || pendingClass?.label}
        </Text>{' '}
        , các thay đổi cục bộ sẽ bị hủy và draft đã lưu của lớp mới sẽ được mở.
      </Text>
    </Modal>
  );
}
