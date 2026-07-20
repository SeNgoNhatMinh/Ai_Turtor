export function getQuizAssignmentId(assignment) {
  return assignment?.assignmentId || assignment?.id || '';
}

function getQuizAssignmentStatus(assignment) {
  return String(assignment?.status || 'DRAFT').toUpperCase();
}

export function isQuizDraft(assignment) {
  return getQuizAssignmentStatus(assignment) === 'DRAFT';
}

export function getQuizGradingModeLabel(gradingMode) {
  const mode = String(gradingMode || '').toUpperCase();
  if (mode === 'TEACHER_MANUAL') return 'Giảng viên chấm';
  if (mode === 'AI_ASSISTED') return 'AI hỗ trợ chấm';
  return 'Backend tự chấm';
}
