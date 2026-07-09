export const getRecordId = (record) => record?.id || record?._id || record?.materialId;
export const getSemesterCode = (record) => record?.semesterCode || record?.code || record?.id;
export const getCourseCode = (record) => record?.courseId || record?.id;
export const getClassCode = (record) => record?.classId || record?.classCode || record?.id;
export const getEnrollmentId = (record) => record?.id || record?._id || record?.enrollmentId;

export const MATERIAL_INDEXING_STATUSES = new Set(['PROCESSING', 'PENDING', 'INDEXING', 'QUEUED']);

export const normalizeMaterialsResponse = (data) => (
  Array.isArray(data?.materials)
    ? data.materials
    : Array.isArray(data?.content)
      ? data.content
      : Array.isArray(data)
        ? data
        : []
);

export const isWebsiteMaterial = (record) => String(record?.sourceType || '').toUpperCase() === 'HTML_URL';

export const isMaterialIndexing = (record) => (
  MATERIAL_INDEXING_STATUSES.has(String(record?.indexingStatus || '').toUpperCase())
);

export const getWebsiteSourceLabel = (record) => {
  if (record?.sourceDomain) return record.sourceDomain;
  try {
    return new URL(record?.sourceUrl || '').host;
  } catch {
    return record?.sourceUrl || 'Website import';
  }
};
