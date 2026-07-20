import { ACCOUNT_ROLES, normalizeAccountRole } from '../../constants/roles.js';

const normalizedStatus = (value) => String(value || '').trim().toUpperCase();

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
  if (!names.length) return 'Add at least one rubric criterion.';
  if (new Set(names.map((name) => name.toLowerCase())).size !== names.length) {
    return 'Rubric criterion names must be unique.';
  }
  if (rows.some((row) => !Number.isFinite(Number(row?.weight)) || Number(row.weight) <= 0)) {
    return 'Every rubric weight must be greater than zero.';
  }
  const sum = rows.reduce((total, row) => total + Number(row.weight || 0), 0);
  if (Math.abs(sum - 1) > 0.001) return `Rubric weights must total 1.0 (current total: ${sum.toFixed(3)}).`;
  return '';
}

export function isTutorV2Reviewer(user) {
  const role = normalizeAccountRole(user?.originalRole || user?.role || user?.roleKey);
  return [ACCOUNT_ROLES.SENIOR_MENTOR, ACCOUNT_ROLES.ADMIN].includes(role);
}

export function getTutorV2Role(user) {
  return normalizeAccountRole(user?.originalRole || user?.role || user?.roleKey);
}

export function getEntityStatusColor(status) {
  const value = normalizedStatus(status);
  if (['COMPLETED', 'APPROVED', 'INDEXED', 'PASSED', 'RESOLVED'].includes(value)) return 'green';
  if (['REJECTED', 'FAILED', 'ERROR', 'CRITICAL'].includes(value)) return 'red';
  if (['PENDING_REVIEW', 'SUBMITTED', 'RUNNING', 'HIGH'].includes(value)) return 'orange';
  if (['ASSIGNED', 'IN_PROGRESS', 'TASK_CREATED', 'MEDIUM'].includes(value)) return 'blue';
  return 'default';
}

export function formatPercent(value) {
  if (value == null || !Number.isFinite(Number(value))) return 'Not available';
  return `${Math.round(Number(value) * 100)}%`;
}
