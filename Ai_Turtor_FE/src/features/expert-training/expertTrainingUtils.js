import { ACCOUNT_ROLES, normalizeAccountRole } from '../../constants/roles.js';

export function parseChapterInput(value) {
  return [...new Set(String(value || '')
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean))];
}

export function getTaskGoldUsage(task) {
  if (!task || String(task.type || '').toUpperCase() !== 'GOLD_QA') return null;
  return 'TRAINING';
}

const CHAPTER_SESSION_META = {
  NOT_STARTED: { key: 'NOT_STARTED', label: 'Chưa train', color: 'default' },
  IN_PROGRESS: { key: 'IN_PROGRESS', label: 'Đang train', color: 'blue' },
  EXAM_READY: { key: 'EXAM_READY', label: 'Có bài thi', color: 'gold' },
  INDEXED: { key: 'INDEXED', label: 'Đã nạp RAG', color: 'green' },
  NO_MATERIAL: { key: 'NO_MATERIAL', label: 'Chưa có tài liệu', color: 'red' },
};

export function getChapterSessionState(chapter, tasks = [], goldQa = []) {
  const title = String(chapter?.title || chapter?.chapter || '').trim();
  const health = String(chapter?.materialHealth || '').toUpperCase();
  if (health === 'NO_MATERIAL' || Number(chapter?.chunkCount) <= 0) {
    return CHAPTER_SESSION_META.NO_MATERIAL;
  }
  const chapterTasks = tasks.filter((task) => String(task.chapter || '').trim() === title);
  const items = goldQa.filter((item) => String(item.chapter || '').trim() === title);
  const pendingExam = items.filter((item) => item.status === 'PENDING_REVIEW');
  const indexed = items.filter((item) => item.status === 'INDEXED');
  const active = chapterTasks.some((task) => (
    ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED'].includes(task.status)
  ));
  if (pendingExam.length) return CHAPTER_SESSION_META.EXAM_READY;
  if (indexed.length && !active) return CHAPTER_SESSION_META.INDEXED;
  if (active || chapterTasks.length) return CHAPTER_SESSION_META.IN_PROGRESS;
  return CHAPTER_SESSION_META.NOT_STARTED;
}

const DETECTED_FROM_LABELS = {
  PDF_BOOKMARK: 'Mục lục PDF',
  PDF_TOC: 'Mục lục PDF',
  MATERIAL: 'Học liệu đã index',
  MATERIAL_TITLE: 'Tiêu đề học liệu',
  HEADING: '',
  MANUAL: 'Thêm thủ công',
  UNKNOWN: 'Chưa xác định',
};

const MATERIAL_HEALTH_META = {
  MATERIAL_OK: { label: 'Material OK', color: 'green' },
  MATERIAL_THIN: { label: 'Material mỏng', color: 'gold' },
  NO_MATERIAL: { label: 'Chưa có material', color: 'default' },
};

const CHAPTER_STATUS_META = {
  SUGGESTED: { label: 'Được phát hiện', color: 'blue' },
  CONFIRMED: { label: 'Đã xác nhận', color: 'green' },
  IGNORED: { label: 'Đã bỏ qua', color: 'default' },
};

export function getDetectedFromLabel(value) {
  const key = String(value || 'UNKNOWN').trim().toUpperCase();
  return DETECTED_FROM_LABELS[key] || key.replaceAll('_', ' ');
}

export function getMaterialHealthMeta(value) {
  const key = String(value || 'NO_MATERIAL').trim().toUpperCase();
  return MATERIAL_HEALTH_META[key] || { label: key.replaceAll('_', ' '), color: 'default' };
}

export function getChapterStatusMeta(value) {
  const key = String(value || 'SUGGESTED').trim().toUpperCase();
  return CHAPTER_STATUS_META[key] || { label: key.replaceAll('_', ' '), color: 'default' };
}

export function isPdfMaterialSource(source) {
  const sourceType = String(source?.sourceType || '').trim().toUpperCase();
  return sourceType === 'PDF' || sourceType.endsWith('_PDF');
}

export function formatChapterPages(chapter) {
  const start = Number(chapter?.pageStart);
  const end = Number(chapter?.pageEnd);
  if (!Number.isFinite(start) || start <= 0) return 'Chưa có trang';
  if (!Number.isFinite(end) || end <= 0 || end === start) return `Trang ${start}`;
  return `Trang ${start}–${end}`;
}

export function formatChapterPreviewPages(preview) {
  return formatChapterPages(preview);
}

export function getChapterPrimaryPdfSource(preview) {
  if (!preview) return null;
  const primaryId = String(preview.primarySourceMaterialId || '').trim();
  const sources = Array.isArray(preview.sourceMaterials) ? preview.sourceMaterials : [];
  if (primaryId) {
    const primary = sources.find((source) => source.id === primaryId);
    if (primary && isPdfMaterialSource(primary)) return primary;
  }
  return sources.find(isPdfMaterialSource) || null;
}

export function getChapterPdfOpenTarget(chapter, preview) {
  const pageStart = Number(preview?.pageStart || chapter?.pageStart) || 0;
  const pageEnd = Number(preview?.pageEnd || chapter?.pageEnd) || 0;
  const previewPdf = getChapterPrimaryPdfSource(preview);
  if (previewPdf) {
    return { source: previewPdf, pageStart, pageEnd };
  }
  const materialId = String(
    preview?.primarySourceMaterialId
    || chapter?.primarySourceMaterialId
    || (Array.isArray(chapter?.sourceMaterialIds) ? chapter.sourceMaterialIds.find(Boolean) : '')
    || ''
  ).trim();
  if (!materialId) return null;
  return {
    source: { id: materialId, sourceType: 'PDF' },
    pageStart,
    pageEnd,
  };
}

export function criteriaRowsToWeights(rows = []) {
  return rows.reduce((result, row) => {
    const name = String(row?.name || '').trim();
    const weight = Number(row?.weight);
    if (name && Number.isFinite(weight)) result[name] = weight;
    return result;
  }, {});
}

export function validateCriteriaWeights(rows = []) {
  const names = rows.map((row) => String(row?.name || '').trim()).filter(Boolean);
  if (!names.length) return 'Thêm ít nhất một tiêu chí Rubric.';
  if (new Set(names.map((name) => name.toLowerCase())).size !== names.length) {
    return 'Tên các tiêu chí Rubric không được trùng nhau.';
  }
  if (rows.some((row) => !Number.isFinite(Number(row?.weight)) || Number(row.weight) <= 0)) {
    return 'Mỗi trọng số Rubric phải lớn hơn 0.';
  }
  const sum = rows.reduce((total, row) => total + Number(row.weight || 0), 0);
  if (Math.abs(sum - 1) > 0.001) return `Tổng trọng số Rubric phải bằng 1.0 (hiện tại: ${sum.toFixed(3)}).`;
  return '';
}

export function isTutorV2Reviewer(user) {
  const role = normalizeAccountRole(user?.originalRole || user?.role || user?.roleKey);
  return [ACCOUNT_ROLES.SENIOR_MENTOR, ACCOUNT_ROLES.ADMIN].includes(role);
}

export function getTutorV2Role(user) {
  return normalizeAccountRole(user?.originalRole || user?.role || user?.roleKey);
}

export function formatPercent(value) {
  if (value == null || !Number.isFinite(Number(value))) return 'Chưa có dữ liệu';
  return `${Math.round(Number(value) * 100)}%`;
}

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function formatExpertTaskDateTime(value, fallback = '—') {
  const date = parseDate(value);
  return date ? date.toLocaleString('vi-VN') : fallback;
}

export function defaultExpertTaskDueAt(daysFromNow = 7) {
  const date = new Date();
  date.setDate(date.getDate() + Math.max(1, daysFromNow));
  date.setHours(23, 59, 0, 0);
  return date.toISOString();
}

export function toExpertTaskDueAtPayload(value) {
  if (!value) return undefined;
  const date = parseDate(value);
  return date ? date.toISOString() : undefined;
}

export function toDateTimeLocalValue(isoValue) {
  const date = parseDate(isoValue);
  if (!date) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function getExpertTaskDueMeta(task) {
  const dueDate = parseDate(task?.dueAt);
  if (!dueDate) {
    return { label: 'Chưa có hạn', tone: 'default', overdue: false };
  }
  const now = Date.now();
  const overdue = dueDate.getTime() < now && !['COMPLETED', 'DONE', 'CANCELLED'].includes(String(task?.status || '').toUpperCase());
  const msLeft = dueDate.getTime() - now;
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  let label = formatExpertTaskDateTime(task.dueAt);
  if (overdue) {
    label = `Quá hạn · ${label}`;
  } else if (daysLeft <= 3) {
    label = `Còn ${Math.max(daysLeft, 0)} ngày · ${label}`;
  }
  return {
    label,
    tone: overdue ? 'danger' : daysLeft <= 3 ? 'warning' : 'default',
    overdue,
  };
}
