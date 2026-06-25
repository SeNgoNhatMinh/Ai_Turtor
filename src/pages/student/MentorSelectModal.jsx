import React from 'react';
import { Empty, Modal, Select } from 'antd';

const { Option } = Select;

const getMentorId = (mentor) => mentor.id || mentor.mentorId || mentor.teacherId || mentor.userId || mentor.email;
const getMentorName = (mentor) => mentor.name || mentor.mentorName || mentor.fullName || mentor.teacherName || mentor.email || 'Support mentor';
const textList = (value) => Array.isArray(value) ? value.join(', ') : value;
const getMentorMeta = (mentor) => [
  mentor.email,
  textList(mentor.specializations) || textList(mentor.categories) || mentor.specialization || mentor.category || mentor.expertise,
  mentor.matchReason,
  mentor.averageRating ? `${mentor.averageRating}/5 rating` : '',
  mentor.responseTimeMinutes ? `~${mentor.responseTimeMinutes} min response` : '',
  mentor.status || mentor.availability,
].filter(Boolean).join(' | ');

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
      title="Choose a mentor to answer this question"
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      okText="Start Chat"
      cancelText="Cancel"
      okButtonProps={{ disabled: !selectedMentorId }}
    >
      {mentors.length === 0 ? (
        <Empty description="No mentors are currently available" />
      ) : (
        <>
          <p>Which mentor would you like to answer this question?</p>
          <Select style={{ width: '100%' }} placeholder="Select a mentor..." value={selectedMentorId} onChange={setSelectedMentorId}>
            {mentors.map((mentor) => (
              <Option key={getMentorId(mentor)} value={getMentorId(mentor)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <strong>{getMentorName(mentor)}</strong>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>{getMentorMeta(mentor) || 'General support'}</span>
                </div>
              </Option>
            ))}
          </Select>
        </>
      )}
    </Modal>
  );
}

export default MentorSelectModal;
