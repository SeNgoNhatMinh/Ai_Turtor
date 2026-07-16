export const HEATMAP_CLASS = {
  high: 'val-high',
  medium: 'val-med',
  med: 'val-med',
  warning: 'val-med',
  low: 'val-low',
  none: 'val-none',
  strong: 'val-none',
};

export const getRecordId = (record) => (
  record?.id || record?._id || record?.materialId || record?.assignmentId
);

export const getClassOptionValue = (item) => item?.classCode || item?.classId || item?.id || '';

export const getClassOptionLabel = (item) => (
  item?.name || item?.className || item?.classCode || item?.classId || item?.id || 'Class section'
);
