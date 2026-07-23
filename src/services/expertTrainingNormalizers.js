const finiteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizedStatus = (value, fallback) => String(value || fallback).trim().toUpperCase();

export const normalizeCourseOption = (course = {}) => ({
  ...course,
  id: course.courseId || course.id || course.code || '',
  name: course.courseName || course.name || course.title || course.courseId || course.id || 'Môn học',
});

const normalizeStringArray = (value) => (
  Array.isArray(value) ? [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))] : []
);

export const normalizeChapterOutline = (chapter = {}) => ({
  ...chapter,
  id: chapter.id || chapter.chapterKey || '',
  courseId: chapter.courseId || '',
  chapterKey: chapter.chapterKey || chapter.id || '',
  title: chapter.title || chapter.chapter || 'Chưa xác định chương',
  status: normalizedStatus(chapter.status, 'SUGGESTED'),
  detectedFrom: normalizedStatus(chapter.detectedFrom, 'UNKNOWN'),
  sourceMaterialIds: normalizeStringArray(chapter.sourceMaterialIds),
  chunkCount: finiteNumber(chapter.chunkCount),
  approxChars: finiteNumber(chapter.approxChars),
  materialHealth: normalizedStatus(chapter.materialHealth, 'NO_MATERIAL'),
  trainingGoldCount: finiteNumber(chapter.trainingGoldCount),
  evaluationGoldCount: finiteNumber(chapter.evaluationGoldCount),
  tocLevel: finiteNumber(chapter.tocLevel),
  pageStart: finiteNumber(chapter.pageStart),
  pageEnd: finiteNumber(chapter.pageEnd),
});

const normalizeChapterSourceMaterial = (material = {}) => ({
  ...material,
  id: material.id || material.materialId || '',
  title: material.title || material.fileName || 'Học liệu chưa đặt tên',
  sourceType: normalizedStatus(material.sourceType, 'PDF'),
  indexingStatus: normalizedStatus(material.indexingStatus, 'UNKNOWN'),
});

export const normalizeChapterPreview = (preview = {}) => ({
  ...preview,
  courseId: preview.courseId || '',
  chapterKey: preview.chapterKey || '',
  title: preview.title || preview.chapter || 'Chưa xác định chương',
  status: normalizedStatus(preview.status, 'SUGGESTED'),
  detectedFrom: normalizedStatus(preview.detectedFrom, 'UNKNOWN'),
  materialHealth: normalizedStatus(preview.materialHealth, 'NO_MATERIAL'),
  chunkCount: finiteNumber(preview.chunkCount),
  approxChars: finiteNumber(preview.approxChars),
  excerpt: preview.excerpt || '',
  excerptTruncated: Boolean(preview.excerptTruncated),
  excerptTotalChars: finiteNumber(preview.excerptTotalChars),
  hasMaterialContent: Boolean(preview.hasMaterialContent),
  sourceMaterials: Array.isArray(preview.sourceMaterials)
    ? preview.sourceMaterials.map(normalizeChapterSourceMaterial).filter((item) => item.id)
    : [],
});

export const normalizeCoverageGap = (gap = {}) => ({
  ...gap,
  id: gap.id || gap.gapId || '',
  courseId: gap.courseId || '',
  chapter: gap.chapter || 'Chưa xác định chương',
  severity: normalizedStatus(gap.severity, 'MEDIUM'),
  status: normalizedStatus(gap.status, 'OPEN'),
  materialCount: finiteNumber(gap.materialCount),
  materialHealth: normalizedStatus(gap.materialHealth, 'NO_MATERIAL'),
  chunkCount: finiteNumber(gap.chunkCount),
  approxChars: finiteNumber(gap.approxChars),
  trainingGoldCount: finiteNumber(gap.trainingGoldCount),
  evaluationGoldCount: finiteNumber(gap.evaluationGoldCount),
  reasons: Array.isArray(gap.reasons) ? gap.reasons.filter(Boolean) : [],
});

export const normalizeExpertTask = (task = {}) => ({
  ...task,
  id: task.id || task.taskId || '',
  courseId: task.courseId || '',
  chapter: task.chapter || 'Chưa xác định chương',
  title: task.title || 'Công việc đóng góp tri thức',
  type: normalizedStatus(task.type, 'GOLD_QA'),
  status: normalizedStatus(task.status, 'OPEN'),
  priority: Math.max(1, Math.min(100, finiteNumber(task.priority, 50))),
  assigneeId: task.assigneeId || '',
  assigneeTier: task.assigneeTier || '',
  requiredUsage: normalizedStatus(task.requiredUsage || task.usage, ''),
  instructions: task.instructions || '',
});

export const normalizeGoldQa = (item = {}) => ({
  ...item,
  id: item.id || item.goldQaId || '',
  courseId: item.courseId || '',
  chapter: item.chapter || 'Chưa xác định chương',
  question: item.question || '',
  goldAnswer: item.goldAnswer || item.answer || '',
  difficulty: normalizedStatus(item.difficulty, 'MEDIUM'),
  usage: normalizedStatus(item.usage, 'TRAINING'),
  holdout: Boolean(item.holdout ?? normalizedStatus(item.usage) === 'EVALUATION'),
  status: normalizedStatus(item.status, 'PENDING_REVIEW'),
  authorId: item.authorId || '',
  sourceTaskId: item.sourceTaskId || item.taskId || '',
  reviewNote: item.reviewNote || '',
  rejectionReason: item.rejectionReason || '',
});

export const normalizeRubric = (item = {}) => ({
  ...item,
  id: item.id || item.rubricId || '',
  courseId: item.courseId || '',
  chapter: item.chapter || 'Chưa xác định chương',
  name: item.name || 'Rubric chuyên gia',
  status: normalizedStatus(item.status, 'PENDING_REVIEW'),
  authorId: item.authorId || '',
  sourceTaskId: item.sourceTaskId || item.taskId || '',
  reviewNote: item.reviewNote || '',
  rejectionReason: item.rejectionReason || '',
  criteriaWeights: item.criteriaWeights && typeof item.criteriaWeights === 'object'
    ? item.criteriaWeights
    : {},
});

export const normalizeEvalRun = (run = {}) => ({
  ...run,
  id: run.id || run.evalRunId || '',
  courseId: run.courseId || '',
  chapter: run.chapter || 'Tất cả chương',
  status: normalizedStatus(run.status, 'QUEUED'),
  totalCases: finiteNumber(run.totalCases),
  passedCases: finiteNumber(run.passedCases),
  averageScore: run.averageScore == null ? null : finiteNumber(run.averageScore),
  hallucinationRate: run.hallucinationRate == null ? null : finiteNumber(run.hallucinationRate),
  passThreshold: run.passThreshold == null ? null : finiteNumber(run.passThreshold),
  regressionDetected: Boolean(run.regressionDetected),
});
