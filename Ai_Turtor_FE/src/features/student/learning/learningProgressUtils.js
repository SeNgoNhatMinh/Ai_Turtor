export const getSuggestionText = (suggestion) => (
  suggestion?.actionText || suggestion?.title || suggestion?.content || String(suggestion || '')
);

export const canDeleteSuggestion = (suggestion) => (
  suggestion?.kind !== 'note' && suggestion?.deletable !== false
);

export const normalizeSuggestionKey = (value) => String(value || '').trim().toLowerCase();

const SUGGESTION_TITLE_LABELS = new Map([
  ['ai learning improvement plan', 'Kế hoạch cải thiện'],
  ['ai learning analysis', 'Phân tích học tập'],
  ['ai suggestion', 'Gợi ý từ AI Tutor'],
  ['course suggestion / feedback', 'Nội dung cần ôn'],
  ['study suggestion', 'Gợi ý học tập'],
]);

const localizeSuggestionTitle = (value) => {
  const title = String(value || '').trim();
  if (!title) return 'Gợi ý học tập';

  const normalized = title.toLowerCase();
  if (SUGGESTION_TITLE_LABELS.has(normalized)) return SUGGESTION_TITLE_LABELS.get(normalized);
  if (normalized.startsWith('improvement plan:')) {
    return `Kế hoạch cải thiện: ${title.slice(title.indexOf(':') + 1).trim()}`;
  }
  return title;
};

const SUGGESTION_STEP_HEADING = /^(?:suggested steps?|next steps?|đề xuất các bước|các bước (?:đề xuất|tiếp theo|nên làm)|bước tiếp theo)\s*:?$/i;
const SUGGESTION_BULLET = /^\s*(?:[-*•]|\d+[.)])\s+(.+)$/;

export const formatStudySuggestion = (suggestion) => {
  const title = localizeSuggestionTitle(suggestion?.title);
  const rawContent = String(suggestion?.content || suggestion?.reason || '').trim();
  const structuredSteps = (Array.isArray(suggestion?.nextSteps) ? suggestion.nextSteps : [])
    .map((step) => String(step || '').trim())
    .filter(Boolean);
  if (!rawContent) return { title, summary: '', steps: [...new Set(structuredSteps)] };

  const preparedContent = rawContent.replace(
    /\s+(Suggested steps?|Next steps?|Đề xuất các bước|Các bước (?:đề xuất|tiếp theo|nên làm)|Bước tiếp theo)\s*:\s*/gi,
    '\n$1:\n',
  );
  const lines = preparedContent
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const summaryLines = [];
  const steps = [];
  let readingSteps = false;

  lines.forEach((line) => {
    if (SUGGESTION_STEP_HEADING.test(line)) {
      readingSteps = true;
      return;
    }

    const bulletMatch = line.match(SUGGESTION_BULLET);
    if (bulletMatch) {
      readingSteps = true;
      steps.push(bulletMatch[1].trim());
      return;
    }

    if (readingSteps) steps.push(line);
    else summaryLines.push(line);
  });

  const summary = summaryLines.join(' ');
  return {
    title,
    summary: normalizeSuggestionKey(summary) === normalizeSuggestionKey(title) ? '' : summary,
    steps: [...new Set([...steps, ...structuredSteps])],
  };
};

export const isLongStudySuggestion = ({ title = '', summary = '', steps = [] } = {}) => {
  const safeSteps = Array.isArray(steps) ? steps : [];
  const totalLength = [title, summary, ...safeSteps]
    .map((value) => String(value || '').trim())
    .join(' ')
    .length;

  return String(title).length > 90
    || String(summary).length > 180
    || safeSteps.length > 3
    || totalLength > 320;
};

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
  content: 'Đã ghim để ưu tiên ôn tập.',
  pinnedOnly: true,
});

export const getMasteryStatus = (rate) => {
  if (rate >= 75) return { label: 'Nền tảng tốt', tone: 'success' };
  if (rate >= 45) return { label: 'Đang củng cố', tone: 'warning' };
  return { label: 'Cần luyện tập thêm', tone: 'error' };
};

export const getRiskColor = (riskLevel) => {
  const value = String(riskLevel || '').toUpperCase();
  if (value === 'HIGH') return 'error';
  if (value === 'MEDIUM') return 'warning';
  return 'success';
};
