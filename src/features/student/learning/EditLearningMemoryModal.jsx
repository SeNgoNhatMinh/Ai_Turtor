import { Input, Modal } from 'antd';

function EditLearningMemoryModal({
  open,
  saving,
  learnedText,
  weakText,
  onLearnedChange,
  onWeakChange,
  onSave,
  onCancel,
}) {
  return (
    <Modal
      title="Chỉnh sửa bộ nhớ học tập"
      open={open}
      onOk={onSave}
      confirmLoading={saving}
      onCancel={onCancel}
      okText="Lưu thay đổi"
      cancelText="Hủy"
    >
      <div className="learning-edit-form">
        <label>
          <span>Chủ đề đã nắm</span>
          <Input.TextArea rows={3} placeholder="Ví dụ: MVC Flow, JPA Repository, SQL Basics" value={learnedText} onChange={(event) => onLearnedChange(event.target.value)} />
        </label>
        <label>
          <span>Chủ đề còn yếu</span>
          <Input.TextArea rows={3} placeholder="Ví dụ: Chuyển đổi nhị phân, lập lịch CPU" value={weakText} onChange={(event) => onWeakChange(event.target.value)} />
        </label>
      </div>
    </Modal>
  );
}

export default EditLearningMemoryModal;
