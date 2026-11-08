const LESSON_HEADING_PREFIX = /^(.*?(?:bài|bai)\s+\d+\s*[:：.\-–—]\s*)([\s\S]*)$/i;
const TITLE_LESSON_TAIL = /\s+(?:\d+[.)]\s+(?:bắt đầu|bat dau|bài|bai)\b|(?:bắt đầu\s+|bat dau\s+)?(?:bài|bai)\s+\d+\s*[:：.\-–—])/i;
const INLINE_LESSON_SPLIT = /(?<=\S)\s+(?=\d+[.)]\s*(?:bắt đầu|bat dau|bài|bai)\b)/gi;
const LESSON_START_FRAGMENT = /^(?:bắt đầu|bat dau)(?:\s+(?:bài|bai))?\s*$/i;

export function stripConcatenatedLessonTail(title) {
  const text = String(title || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const headed = text.match(LESSON_HEADING_PREFIX);
  const prefix = headed ? headed[1] : '';
  const body = headed ? headed[2] : text;
  const cut = body.search(TITLE_LESSON_TAIL);
  const cleaned = (cut < 0 ? body : body.slice(0, cut)).trim();
  return `${prefix}${cleaned}`.trim();
}

function expandInlineLessonLines(text) {
  return String(text || '').replace(INLINE_LESSON_SPLIT, '\n').split(/\r?\n/);
}

function parseNumberedLesson(text) {
  const topic = stripConcatenatedLessonTail(text);
  if (!topic) return null;

  const deepList = topic.match(
    /^(?:gợi ý\s+)?học chuyên sâu bài\s+(\d+)\s*[:：.\-–—]\s*(.+)$/i,
  );
  if (deepList) {
    return { number: deepList[1], title: deepList[2].trim(), kind: 'deep-list' };
  }

  const deepTeach = topic.match(
    /^đào sâu bài\s+(\d+)\s*[:：.\-–—]\s*(.+)$/i,
  );
  if (deepTeach) {
    return { number: deepTeach[1], title: deepTeach[2].trim(), kind: 'deep-teach' };
  }

  const numbered = topic.match(
    /^(?:bắt đầu\s+)?(?:bài|bai)\s+(\d+)\s*[:：.\-–—]\s*(.+)$/i,
  );
  if (numbered) {
    return { number: numbered[1], title: numbered[2].trim(), kind: 'lesson' };
  }
  return null;
}

export function teacherStudentPathLabel(text) {
  const lesson = parseNumberedLesson(text);
  if (lesson?.kind === 'deep-list') return 'Yêu cầu học chuyên sâu';
  if (lesson?.kind === 'deep-teach') return `Đào sâu bài ${lesson.number}`;
  if (lesson?.kind === 'lesson') return `Bài ${lesson.number}`;
  return '';
}

export function isGuidedLessonPrompt(text) {
  return parseNumberedLesson(text)?.kind === 'lesson';
}

function isDeepDiveListPrompt(text) {
  return parseNumberedLesson(text)?.kind === 'deep-list';
}

function isDeepDiveTopicPrompt(text) {
  return parseNumberedLesson(text)?.kind === 'deep-teach';
}

export function buildDeepDiveListPrompt(lessonText, answerText = '') {
  const lesson = parseNumberedLesson(lessonText);
  if (!lesson || lesson.kind !== 'lesson') return '';
  if (answerHasDeepDiveList(answerText)) return '';
  return `Gợi ý học chuyên sâu bài ${lesson.number}: ${lesson.title}`;
}

function answerHasDeepDiveList(answer) {
  return /^#{1,6}\s*(?:học chuyên sâu|học tiếp phần này)\s*$/im.test(String(answer || ''));
}

export function buildDeepDiveTopicPrompt(lessonNumber, topicText) {
  const number = String(lessonNumber || '').trim();
  const topic = String(topicText || '').trim();
  if (!number || !topic) return '';
  if (parseNumberedLesson(topic)?.kind === 'lesson') {
    return normalizeLessonStart(topic);
  }
  if (isDeepDiveTopicPrompt(topic) || isDeepDiveListPrompt(topic)) {
    return topic;
  }
  return `Đào sâu bài ${number}: ${topic}`;
}

export function resolveChatStudyTip(question, tipText) {
  const tip = String(tipText || '').trim();
  if (!tip) return '';
  if (parseNumberedLesson(tip)?.kind === 'lesson' || /^(?:bắt đầu\s+)?(?:bài|bai)\s+\d+/i.test(tip)) {
    return normalizeLessonStart(tip) || tip;
  }
  if (isDeepDiveTopicPrompt(tip) || isDeepDiveListPrompt(tip)) {
    return tip;
  }
  const lesson = parseNumberedLesson(question);
  if (lesson) {
    return buildDeepDiveTopicPrompt(lesson.number, tip);
  }
  // Tips under "## Học chuyên sâu" are deep-dive angles, never "Ôn tập phần …".
  return `Đào sâu: ${tip}`;
}

function normalizeLessonStart(suggestionText) {
  const topic = stripConcatenatedLessonTail(suggestionText);
  if (!topic) return '';

  const numbered = topic.match(/^(?:bắt đầu\s+)?(?:bài|bai)\s+(\d+)\s*[:：.\-–—]\s*(.+)$/i);
  if (numbered) {
    const title = stripConcatenatedLessonTail(numbered[2]);
    if (!title || LESSON_START_FRAGMENT.test(title)) return '';
    return `Bắt đầu bài ${numbered[1]}: ${title}`;
  }
  if (/bắt đầu bài\s+\d+/i.test(topic) || /bat dau bai\s+\d+/i.test(topic)) {
    return topic;
  }
  return '';
}

function buildTopicStudyPrompt(suggestionText) {
  const topic = String(suggestionText || '').trim();
  if (!topic) return '';
  if (/^(?:nay|hôm nay)\s+(?:mình|em)\s+học\b/i.test(topic)
    || /^(?:mình|em)\s+muốn\s+học\b/i.test(topic)
    || /^bắt đầu\s+học\b/i.test(topic)) {
    return topic;
  }
  return `Nay mình học ${topic}`;
}

export function buildLessonChatPrompt(suggestionText) {
  const topic = String(suggestionText || '').trim();
  if (!topic) return '';
  return normalizeLessonStart(topic) || buildTopicStudyPrompt(topic);
}

function parseBulletsUnderHeadings(answer, headingPattern, maxItems = 8) {
  const text = String(answer || '');
  if (!text.trim()) return [];

  const items = [];
  const seen = new Set();
  let inSection = false;
  const limit = Number.isFinite(maxItems) && maxItems > 0 ? maxItems : Number.POSITIVE_INFINITY;
  for (const raw of text.split(/\r?\n/)) {
    const trimmed = String(raw || '').trim();
    if (/^#{1,6}\s+\S/.test(trimmed)) {
      const heading = trimmed.replace(/^#{1,6}\s*/, '');
      inSection = headingPattern.test(heading);
      continue;
    }
    if (!inSection) continue;
    const line = stripConcatenatedLessonTail(trimmed
      .replace(/^[-*+]\s+/, '')
      .replace(/^\d+[.)]\s+/, '')
      .replace(/^\[([^\]]+)\]\([^)]+\)$/, '$1')
      .replace(/[*_`]+/g, '')
      .replace(/\s+/g, ' ')
      .trim());
    if (!line || LESSON_START_FRAGMENT.test(line) || /^[\s–—_*+.·•…-]+$/u.test(line)) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ title: line, suggestionText: line });
    if (items.length >= limit) break;
  }
  return items;
}

export function parseDeepDiveSuggestionsFromAnswer(answer) {
  return parseBulletsUnderHeadings(answer, /^(?:học chuyên sâu|học tiếp phần này)\s*$/i);
}

const CURRICULUM_STARTER_NOISE = /^(?:bạn có thể bắt đầu|các chương trong tài liệu|các chủ đề trong curriculum|mẹo\b)/i;

/** Book front/back matter and cover titles that should never appear as study chips. */
export function isCurriculumStarterNoiseTitle(title) {
  const raw = String(title || '').trim();
  if (!raw || raw.length < 4) return true;
  const stripped = raw
    .toLowerCase()
    .replace(/^[\d.]+\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (CURRICULUM_STARTER_NOISE.test(stripped) || /:$/.test(raw)) return true;
  if (/^part\s+(?:[ivxlcdm]+|\d+)\b/i.test(stripped)) return true;
  if (/^phần\s+(?:[ivxlcdm]+|\d+)\b/i.test(stripped)) return true;
  if (/^professional\b/i.test(stripped)) return true;
  if (/what you will\b/i.test(stripped)) return true;
  if (/who this book\b/i.test(stripped)) return true;
  if (/\bin this book\b/i.test(stripped)) return true;
  if (/for web applications/i.test(stripped)) return true;
  if (/®/.test(raw)) return true;
  if (/^(?:appendix|phụ lục|phu luc)\b/i.test(stripped)) return true;
  if (/^(?:answers?(?:\s+to)?|solutions?(?:\s+to)?|đáp án|further reading|tài liệu tham khảo)\b/i.test(stripped)) {
    return true;
  }
  if (/^(?:contents|preface|foreword|acknowledg|copyright|index|errata|advertisement)\b/i.test(stripped)) {
    return true;
  }
  // A bare "Introduction" is book opening. "Chapter 1. Introduction …" is the first study chapter.
  if (/^(?:introduction|summary|overview|conclusion)\b/i.test(stripped)) {
    const numberedChapter = /^(?:chapter|chương|chuong|ch\.)\s+[1-9]\d*\b/i.test(raw)
      || /^[1-9]\d*(?:\.\d+)*[.)]?\s+\S/.test(raw);
    return !numberedChapter;
  }
  return false;
}

/**
 * Material chapter titles listed under the welcome "Gợi ý học tập" section.
 * Rendered as clickable chips; UI paginates them (5 at a time).
 */
export function parseCurriculumStarterSuggestions(answer) {
  return parseBulletsUnderHeadings(answer, /gợi ý học tập\s*$/i, Number.POSITIVE_INFINITY)
    .filter((item) => !isCurriculumStarterNoiseTitle(item.title))
    .map((item) => ({ ...item, curriculumStarter: true }));
}

/**
 * The curriculum "Gợi ý học tập" section rendered as text. When its starters
 * are shown as clickable suggestions, the plain list is a duplicate.
 */
export function stripCurriculumStarterSection(answer) {
  const lines = String(answer || '').split(/\r?\n/);
  const kept = [];
  let skipping = false;
  for (const raw of lines) {
    const trimmed = String(raw || '').trim();
    if (/^#{1,6}\s+\S/.test(trimmed)) {
      skipping = /gợi ý học tập\s*$/i.test(trimmed.replace(/^#{1,6}\s*/, ''));
      if (skipping) continue;
    }
    if (!skipping) kept.push(raw);
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function parseNextLessonSuggestionsFromAnswer(answer) {
  const fromHeading = parseBulletsUnderHeadings(answer, /^(?:bài tiếp theo|bài kế tiếp)\s*$/i);
  if (fromHeading.length > 0) return fromHeading;
  return parseLessonSuggestionsFromAnswer(answer);
}

export function parseLessonSuggestionsFromAnswer(answer) {
  const text = String(answer || '');
  if (!text.trim()) return [];

  const linePattern = /^(?:\d+[.)]\s*)?(?:bắt đầu\s+|bat dau\s+)?(?:bài|bai)\s+(\d+)\s*[:：.-]\s*(.+)$/i;
  const seen = new Set();
  const items = [];
  for (const raw of expandInlineLessonLines(text)) {
    const line = String(raw || '')
      .replace(/^[\s>*-]+/, '')
      .replace(/[*_`]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const match = line.match(linePattern);
    if (!match || seen.has(match[1])) continue;
    const title = stripConcatenatedLessonTail(match[2]);
    if (!title || LESSON_START_FRAGMENT.test(title)) continue;
    seen.add(match[1]);
    const prompt = `Bắt đầu bài ${match[1]}: ${title}`;
    items.push({ title: prompt, suggestionText: prompt });
    if (items.length >= 8) break;
  }
  if (items.length < 2) return [];
  return items;
}

const INTERNAL_LESSON_TITLE = /senior-approved|gold\s+q\s*&\s*a|gold\s+qa/i;

function withoutInternalLessonLabel(value) {
  return String(value || '')
    .replace(/senior-approved(?:\s+knowledge|\s+v2(?:\s+gold\s+q&a)?)?\s*:\s*/ig, '')
    .replace(/gold\s+q&a\s*:\s*/ig, '')
    .trim();
}

export function lessonSuggestionsForMessage(message) {
  const hasApiSuggestions = Array.isArray(message?.nextImproveSuggestions);
  const suggestions = (hasApiSuggestions
    ? message.nextImproveSuggestions
    : parseLessonSuggestionsFromAnswer(message?.answer || message?.content || ''))
    .filter((suggestion) => !INTERNAL_LESSON_TITLE.test(
      typeof suggestion === 'object' && suggestion !== null
        ? suggestion.title || suggestion.suggestionText || ''
        : suggestion,
    ));
  if (suggestions.length === 0) return [];

  return suggestions.map((suggestion) => {
    const objectSuggestion = typeof suggestion === 'object' && suggestion !== null
      ? suggestion
      : { title: String(suggestion || '').trim() };
    const title = stripConcatenatedLessonTail(withoutInternalLessonLabel(objectSuggestion.title));
    const suggestionText = stripConcatenatedLessonTail(
      withoutInternalLessonLabel(objectSuggestion.suggestionText || title),
    );
    if (!title || LESSON_START_FRAGMENT.test(title)) return null;
    return {
      ...objectSuggestion,
      title,
      suggestionText,
      interactionType: 'GUIDED_LESSON',
      sourceMaterialIds: Array.isArray(suggestion?.sourceMaterialIds)
        ? suggestion.sourceMaterialIds
        : [],
      sourceChunkIds: Array.isArray(suggestion?.sourceChunkIds)
        ? suggestion.sourceChunkIds
        : [],
    };
  }).filter(Boolean);
}

export function buildStudySuggestionPrompt(suggestionText, suggestion = null) {
  const topic = String(suggestionText || '').trim();
  if (!topic) return '';
  if (suggestion?.guidedPracticeAttempt) return topic;
  if (suggestion?.improvePlanId && suggestion?.planItemId) {
    return `Ôn tập theo Improve Plan: ${topic}`;
  }
  if (isDeepDiveListPrompt(topic) || isDeepDiveTopicPrompt(topic)) {
    return topic;
  }
  // Deep-dive tips clicked from "## Học chuyên sâu" (or the CTA) must stay
  // as đào sâu / verbatim study tips — never rewrite them as "Ôn tập phần".
  if (suggestion?.interactionType === 'SOURCE_BACKED_STUDY_TIP'
    || /^đào sâu\b/i.test(topic)) {
    return topic;
  }
  // Curriculum starters are chapter titles (or legacy full questions). Chapter
  // titles become a study ask; complete questions stay verbatim.
  if (suggestion?.curriculumStarter) {
    if (/^(?:tôi muốn|giải thích|kiểm tra|hướng dẫn|cho tôi|bắt đầu)\b/i.test(topic)
      || /[.?！？]$/.test(topic)) {
      return topic;
    }
    return `Tôi muốn tìm hiểu về ${topic}.`;
  }

  const lesson = normalizeLessonStart(topic);
  if (lesson) return lesson;

  return `Ôn tập phần "${topic}"`;
}
