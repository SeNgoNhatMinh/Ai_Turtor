export const getSuggestionText = (suggestion) => (
  suggestion?.title || suggestion?.content || String(suggestion || '')
);

export const normalizeSuggestionKey = (value) => String(value || '').trim().toLowerCase();

export const getPlanId = (plan) => plan?.id || plan?.planId;

export const formatLearningDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const makePinnedSuggestionItem = (text) => ({
  priority: 'pinned',
  title: text,
  content: 'Pinned for focused review.',
  pinnedOnly: true,
});

export const getMasteryStatus = (rate) => {
  if (rate >= 75) return { label: 'Strong foundation', tone: 'success' };
  if (rate >= 45) return { label: 'Building consistency', tone: 'warning' };
  return { label: 'Needs focused practice', tone: 'error' };
};

export const getRiskColor = (riskLevel) => {
  const value = String(riskLevel || '').toUpperCase();
  if (value === 'HIGH') return 'error';
  if (value === 'MEDIUM') return 'warning';
  return 'success';
};
