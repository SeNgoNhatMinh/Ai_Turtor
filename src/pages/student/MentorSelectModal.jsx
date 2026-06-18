import React from 'react';
import { Empty, Modal, Select } from 'antd';

const { Option } = Select;

function MentorSelectModal({
  open,
  mentors,
  selectedMentorId,
  setSelectedMentorId,
  onCancel,
  onOk,
}) {
  return (
    <Modal
      title="Choose a Support Mentor"
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      okText="Start Chat"
      cancelText="Cancel"
    >
      {mentors.length === 0 ? (
        <Empty description="No mentors are currently available" />
      ) : (
        <>
          <p>Choose a mentor from the list of available supporters:</p>
          <Select style={{ width: '100%' }} placeholder="Choose a mentor..." value={selectedMentorId} onChange={setSelectedMentorId}>
            {mentors.map((mentor) => (
              <Option key={mentor.id} value={mentor.id}>
                {mentor.name || mentor.mentorName || mentor.email} - {mentor.specialization || 'General support'}
              </Option>
            ))}
          </Select>
        </>
      )}
    </Modal>
  );
}

export default MentorSelectModal;
