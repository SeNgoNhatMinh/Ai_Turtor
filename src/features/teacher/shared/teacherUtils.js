import { classIdMatches } from '../../../utils/academicIds.js';

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

// API paths must use ClassSection.classId exactly as stored by the backend.
// classCode is a display/search alias only (for example SE1833 vs 1833).
export const getClassOptionValue = (item) => {
  const classCode = String(item?.classCode || '').trim();
  const classId = String(
    item?.classId
    || item?.classSection?.classId
    || item?.sectionId
    || '',
  ).trim();
  return classId || classCode || item?.id || '';
};

export const getClassOptionLabel = (item) => (
  item?.name || item?.className || item?.classCode || item?.classId || item?.id || 'Class section'
);

export const getClassCourseId = (item) => {
  const nestedCourseId = item?.course?.courseId || item?.course?.id;
  return item?.courseId
    || item?.courseCode
    || nestedCourseId
    || (typeof item?.course === 'string' ? item.course : '')
    || '';
};

export const findTeacherClass = (classes, classId) => (
  (Array.isArray(classes) ? classes : []).find((item) => (
    classIdMatches(getClassOptionValue(item), classId)
  ))
);
