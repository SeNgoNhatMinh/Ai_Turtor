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
      title="Edit course memory"
      open={open}
      onOk={onSave}
      confirmLoading={saving}
      onCancel={onCancel}
      okText="Save memory"
      cancelText="Cancel"
    >
      <div className="learning-edit-form">
        <label>
          <span>Learned topics</span>
          <Input.TextArea rows={3} placeholder="Example: MVC Flow, JPA Repository, SQL Basics" value={learnedText} onChange={(event) => onLearnedChange(event.target.value)} />
        </label>
        <label>
          <span>Weak topics</span>
          <Input.TextArea rows={3} placeholder="Example: Binary conversion, CPU scheduling" value={weakText} onChange={(event) => onWeakChange(event.target.value)} />
        </label>
      </div>
    </Modal>
  );
}

export default EditLearningMemoryModal;
