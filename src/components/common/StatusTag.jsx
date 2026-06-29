import React from 'react';
import { Tag } from 'antd';

const statusMap = {
  PENDING: { color: 'orange', label: 'Pending' },
  PENDING_OFFER: { color: 'orange', label: 'Waiting for mentor' },
  OFFERED: { color: 'blue', label: 'Mentor offered' },
  ASSIGNED: { color: 'green', label: 'Assigned' },
  IN_CHAT: { color: 'green', label: 'Live chat' },
  MENTOR_MATCHING: { color: 'blue', label: 'Choose mentor' },
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
