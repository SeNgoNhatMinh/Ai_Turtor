export const canReviewKnowledge = (role) => {
  const normalized = String(role || '').trim().toUpperCase();
  return ['ADMIN', 'SENIOR_MENTOR'].includes(normalized);
};
