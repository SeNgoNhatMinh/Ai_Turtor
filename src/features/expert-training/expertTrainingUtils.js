import { ACCOUNT_ROLES, normalizeAccountRole } from '../../constants/roles.js';

export function parseChapterInput(value) {
  return [...new Set(String(value || '')
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean))];
}

export function getTaskGoldUsage(task) {
  if (!task || String(task.type || '').toUpperCase() !== 'GOLD_QA') return null;
  const context = `${task.title || ''} ${task.instructions || ''}`.toUpperCase();
  if (context.includes('EVALUATION') || context.includes('HOLDOUT')) return 'EVALUATION';
  if (context.includes('TRAINING') || context.includes('RAG BRAIN')) return 'TRAINING';
  return null;
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
