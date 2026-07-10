export const ACADEMIC_CANDIDATE_OPTIONS = [
  { value: 'ACADEMIC_KNOWLEDGE', label: 'Academic knowledge' },
  { value: 'MATERIAL_CORRECTION', label: 'Material correction' },
  { value: 'FAQ_CLARIFICATION', label: 'FAQ clarification' },
];

export const ACADEMIC_CANDIDATE_TYPES = new Set(
  ACADEMIC_CANDIDATE_OPTIONS.map((option) => option.value),
);

export const formatKnowledgeCandidateStatus = (status) => {
  const normalized = String(status || '').trim().toUpperCase();
  if (['APPROVED', 'APPROVED_INTO_AI_KNOWLEDGE', 'INDEXED'].includes(normalized)) {
    return 'Approved into AI knowledge';
  }
  if (['REJECTED', 'DECLINED'].includes(normalized)) return 'Rejected';
  return 'Pending senior approval';
};
