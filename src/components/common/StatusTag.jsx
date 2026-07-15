import { Tag } from 'antd';

const statusMap = {
  PENDING: { color: 'orange', label: 'Pending' },
  PENDING_OFFER: { color: 'orange', label: 'Waiting for teacher matching' },
  OFFERED: { color: 'blue', label: 'Teacher options ready' },
  ASSIGNED: { color: 'green', label: 'Teacher selected' },
  MENTOR_SELECTED: { color: 'green', label: 'Teacher selected' },
  CHAT_ACTIVE: { color: 'green', label: 'Live support chat' },
  IN_CHAT: { color: 'green', label: 'Live support chat' },
  MENTOR_MATCHING: { color: 'blue', label: 'Finding a teacher' },
  ANSWERED_NO_KNOWLEDGE_CANDIDATE: { color: 'green', label: 'Answered' },
  ANSWERED_PENDING_SENIOR_REVIEW: { color: 'purple', label: 'Answered - senior review' },
  COMPLETED: { color: 'default', label: 'Completed' },
  CANCELLED: { color: 'default', label: 'Cancelled' },
  CLOSED: { color: 'default', label: 'Closed' },
  ACTIVE: { color: 'green', label: 'Active' },
  INACTIVE: { color: 'default', label: 'Inactive' },
  APPROVED: { color: 'green', label: 'Approved' },
  REJECTED: { color: 'red', label: 'Rejected' },
};

function StatusTag({ status }) {
  const normalized = String(status || '').toUpperCase();
  const item = statusMap[normalized] || { color: 'default', label: status || 'Unknown' };
  return <Tag color={item.color}>{item.label}</Tag>;
}

export default StatusTag;
