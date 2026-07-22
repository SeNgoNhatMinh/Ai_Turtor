import { ACCOUNT_ROLES, normalizeAccountRole } from '../../constants/roles.js';

export function parseChapterInput(value) {
  return [...new Set(String(value || '')
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean))];
}

export function getTaskGoldUsage(task) {
  if (!task || String(task.type || '').toUpperCase() !== 'GOLD_QA') return null;
  const explicitUsage = String(task.requiredUsage || task.usage || '').trim().toUpperCase();
  if (['TRAINING', 'EVALUATION'].includes(explicitUsage)) return explicitUsage;
  const context = `${task.title || ''} ${task.instructions || ''}`.toUpperCase();
  if (context.includes('EVALUATION') || context.includes('HOLDOUT')) return 'EVALUATION';
  if (context.includes('TRAINING') || context.includes('RAG BRAIN')) return 'TRAINING';
  return null;
}

const DETECTED_FROM_LABELS = {
  PDF_BOOKMARK: 'Mục lục PDF',
  PDF_TOC: 'Mục lục PDF',
  MATERIAL: 'Học liệu đã index',
  MATERIAL_TITLE: 'Tiêu đề học liệu',
  HEADING: 'Tiêu đề tài liệu',
  MANUAL: 'Thêm thủ công',
  UNKNOWN: 'Chưa xác định',
};

const MATERIAL_HEALTH_META = {
  MATERIAL_OK: { label: 'Đủ tài liệu', color: 'green' },
  MATERIAL_THIN: { label: 'Tài liệu còn mỏng', color: 'gold' },
  NO_MATERIAL: { label: 'Chưa có tài liệu', color: 'red' },
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
