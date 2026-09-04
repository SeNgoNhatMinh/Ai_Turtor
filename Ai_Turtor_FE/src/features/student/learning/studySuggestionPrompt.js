export function parseNumberedLesson(text) {
  const topic = String(text || '').trim();
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

export function isDeepDiveListPrompt(text) {
  return parseNumberedLesson(text)?.kind === 'deep-list';
}

export function isDeepDiveTopicPrompt(text) {
  return parseNumberedLesson(text)?.kind === 'deep-teach';
}

export function buildDeepDiveListPrompt(lessonText, answerText = '') {
  const lesson = parseNumberedLesson(lessonText);
  if (!lesson || lesson.kind !== 'lesson') return '';
  if (answerHasDeepDiveList(answerText)) return '';
  return `Gợi ý học chuyên sâu bài ${lesson.number}: ${lesson.title}`;
}

export function answerHasDeepDiveList(answer) {
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
  const lesson = parseNumberedLesson(question);
  if (lesson) {
    return buildDeepDiveTopicPrompt(lesson.number, tip);
  }
  return tip;
}

export function normalizeLessonStart(suggestionText) {
  const topic = String(suggestionText || '').trim();
  if (!topic) return '';

  const numbered = topic.match(/^(?:bắt đầu\s+)?(?:bài|bai)\s+(\d+)\s*[:：.\-–—]\s*(.+)$/i);
  if (numbered) {
    return `Bắt đầu bài ${numbered[1]}: ${numbered[2].trim()}`;
  }
  if (/bắt đầu bài\s+\d+/i.test(topic) || /bat dau bai\s+\d+/i.test(topic)) {
    return topic;
  }
  return '';
}

export function buildTopicStudyPrompt(suggestionText) {
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

function parseBulletsUnderHeadings(answer, headingPattern) {
  const text = String(answer || '');
  if (!text.trim()) return [];

  const items = [];
  const seen = new Set();
  let inSection = false;
  for (const raw of text.split(/\r?\n/)) {
    const trimmed = String(raw || '').trim();
    if (/^#{1,6}\s+\S/.test(trimmed)) {
      const heading = trimmed.replace(/^#{1,6}\s*/, '');
      inSection = headingPattern.test(heading);
      continue;
    }
    if (!inSection) continue;
    const line = trimmed
      .replace(/^[-*+]\s+/, '')
      .replace(/^\d+[.)]\s+/, '')
      .replace(/^\[([^\]]+)\]\([^)]+\)$/, '$1')
      .replace(/[*_`]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!line || /^[\s–—_*+.·•…-]+$/u.test(line)) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ title: line, suggestionText: line });
    if (items.length >= 8) break;
  }
  return items;
}

export function parseDeepDiveSuggestionsFromAnswer(answer) {
  return parseBulletsUnderHeadings(answer, /^(?:học chuyên sâu|học tiếp phần này)\s*$/i);
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
  for (const raw of text.split(/\r?\n/)) {
    const line = String(raw || '')
      .replace(/^[\s>*-]+/, '')
      .replace(/[*_`]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const match = line.match(linePattern);
    if (!match || seen.has(match[1])) continue;
    const title = String(match[2] || '').trim();
    if (!title) continue;
    seen.add(match[1]);
    const prompt = `Bắt đầu bài ${match[1]}: ${title}`;
    items.push({ title: prompt, suggestionText: prompt });
    if (items.length >= 8) break;
  }
  if (items.length < 2) return [];
  return items;
}

export function lessonSuggestionsForMessage(message) {
  const fromApi = Array.isArray(message?.nextImproveSuggestions) ? message.nextImproveSuggestions : [];
  if (fromApi.length > 0) return fromApi;
  return parseLessonSuggestionsFromAnswer(message?.answer || message?.content || '');
}

export function buildStudySuggestionPrompt(suggestionText) {
  const topic = String(suggestionText || '').trim();
  if (!topic) return '';
  if (isDeepDiveListPrompt(topic) || isDeepDiveTopicPrompt(topic)) {
    return topic;
  }

  const lesson = normalizeLessonStart(topic);
  if (lesson) return lesson;

  return `Em muốn ôn tập phần "${topic}" từ improve plan. Hãy hướng dẫn em từng bước trong đoạn chat này, giải thích dễ hiểu, có ví dụ nhỏ và gợi ý em nên tự kiểm tra gì tiếp theo.`;
}
