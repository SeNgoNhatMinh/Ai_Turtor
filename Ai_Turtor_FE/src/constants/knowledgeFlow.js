export const formatKnowledgeCandidateStatus = (status) => {
  const normalized = String(status || '').trim().toUpperCase();
  if (['APPROVED', 'APPROVED_INTO_AI_KNOWLEDGE', 'INDEXED'].includes(normalized)) {
    return 'Đã phê duyệt vào tri thức AI';
  }
  if (['REJECTED', 'DECLINED'].includes(normalized)) return 'Đã từ chối';
  return 'Chờ Senior Mentor phê duyệt';
};
