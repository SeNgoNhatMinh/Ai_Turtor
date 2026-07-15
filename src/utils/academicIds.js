export const normalizeAcademicId = (value) => String(value || '').trim().toUpperCase();

export const normalizeClassLookupKey = (value) => {
  const normalized = normalizeAcademicId(value).replace(/[\s_-]/g, '');
  if (/^SE\d+$/.test(normalized)) return normalized.slice(2);
  return normalized;
};

export const classIdMatches = (left, right) => {
  const leftRaw = normalizeAcademicId(left);
  const rightRaw = normalizeAcademicId(right);
  if (!leftRaw || !rightRaw) return false;
  return leftRaw === rightRaw || normalizeClassLookupKey(leftRaw) === normalizeClassLookupKey(rightRaw);
};

export const getClassCodeValue = (record) => (
  record?.classCode
  || record?.classSection?.classCode
  || record?.classSectionCode
  || record?.classId
  || record?.sectionId
  || record?.classSection?.classId
  || record?.classSection?.id
  || record?.id
  || ''
);

export const getClassAliases = (record) => [
  record?.classCode,
  record?.classSection?.classCode,
  record?.classSectionCode,
  record?.classId,
  record?.sectionId,
  record?.classSection?.classId,
  record?.classSection?.id,
  record?.id,
].filter(Boolean).map(String);
