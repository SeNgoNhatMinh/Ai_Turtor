export const HEATMAP_CLASS = {
  high: 'val-high',
  medium: 'val-med',
  med: 'val-med',
  warning: 'val-med',
  low: 'val-low',
  none: 'val-none',
  strong: 'val-none',
};

export const getSupportMessageTime = (message) => {
  const value = message?.sentAt || message?.timestamp || message?.createdAt;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

export const normalizeSupportHistory = (history) => {
  const list = Array.isArray(history) ? history : [];
  const hasTimestamps = list.some((item) => getSupportMessageTime(item) !== null);
  if (!hasTimestamps) return [...list].reverse();
  return [...list].sort((a, b) => (getSupportMessageTime(a) ?? 0) - (getSupportMessageTime(b) ?? 0));
};

export const getRecordId = (record) => record?.id || record?._id || record?.materialId || record?.assignmentId;

export const getClassOptionValue = (item) => item?.classCode || item?.classId || item?.id || '';

export const getClassOptionLabel = (item) =>
  item?.name || item?.className || item?.classCode || item?.classId || item?.id || 'Class section';
