import { normalizeSuggestions } from '../../../services/normalizers.js';
import { suggestionMatchesText } from '../../../utils/storage.js';

const isSuggestionServiceFailure = (suggestion) => {
  const value = `${suggestion?.title || ''} ${suggestion?.content || ''}`.toLowerCase();
  return value.includes('ai suggestion failed')
    || value.includes('llm')
    || value.includes('dịch vụ llm');
};

const decorateLocalSuggestion = (item) => ({
  ...item,
  persistence: 'LOCAL_ANALYSIS',
  deletable: item.kind !== 'note' && String(item.source || '').toUpperCase() !== 'RULE',
});

export const createStudyTipSuggestion = (text) => ({
  priority: 'high',
  title: String(text || '').trim(),
  content: 'Created from the study note you selected in AI Tutor Chat. Review it first, then use Study now or Create quiz when you are ready.',
  source: 'CHAT_STUDY_TIP',
  persistence: 'LOCAL_ANALYSIS',
  deletable: true,
});

export const normalizeAnalyzedSuggestions = (data) => (
  normalizeSuggestions(data)
    .filter((item) => !isSuggestionServiceFailure(item))
    .map(decorateLocalSuggestion)
);

export const normalizeCachedSuggestionList = (data) => (
  normalizeSuggestions(data).map((item) => (
    item.persistence ? item : decorateLocalSuggestion(item)
  ))
);

export const getSuggestionDeleteContext = (suggestion) => {
  const displayText = String(
    suggestion?.actionText || suggestion?.title || suggestion?.content || suggestion || '',
  ).trim();
  return {
    displayText,
    deleteValue: String(suggestion?.deleteValue || displayText).trim(),
    shouldDeleteFromBackend: suggestion?.persistence !== 'LOCAL_ANALYSIS',
  };
};

export const backendStillContainsSuggestion = (response, deleteValue) => (
  Array.isArray(response?.improveSuggestions)
  && response.improveSuggestions.some(
    (item) => String(item).trim().toLowerCase() === String(deleteValue).trim().toLowerCase(),
  )
);

export const filterDeletedSuggestions = (suggestions, target) => (
  (Array.isArray(suggestions) ? suggestions : [])
    .filter((item) => !suggestionMatchesText(item, target))
);
