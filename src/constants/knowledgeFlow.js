export const ACADEMIC_CANDIDATE_OPTIONS = [
  { value: 'ACADEMIC_KNOWLEDGE', label: 'Kiến thức học thuật' },
  { value: 'MATERIAL_CORRECTION', label: 'Sửa nội dung tài liệu' },
  { value: 'FAQ_CLARIFICATION', label: 'Làm rõ câu hỏi thường gặp' },
];

export const ACADEMIC_CANDIDATE_TYPES = new Set(
  ACADEMIC_CANDIDATE_OPTIONS.map((option) => option.value),
);

export const formatKnowledgeCandidateStatus = (status) => {
  const normalized = String(status || '').trim().toUpperCase();
  if (['APPROVED', 'APPROVED_INTO_AI_KNOWLEDGE', 'INDEXED'].includes(normalized)) {
    return 'Đã phê duyệt vào tri thức AI';
  }
  if (['REJECTED', 'DECLINED'].includes(normalized)) return 'Cần chỉnh sửa';
  return 'Chờ Senior Mentor phê duyệt';
};
