export function normalizeLessonStart(suggestionText) {
  const topic = String(suggestionText || '').trim();
  if (!topic) return '';

  const numbered = topic.match(/^(?:bắt đầu\s+)?(?:bài|bai)\s+(\d+)\s*[:：.\-]\s*(.+)$/i);
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

export function parseLessonSuggestionsFromAnswer(answer) {
  const text = String(answer || '');
  if (!text.trim()) return [];

  const linePattern = /^(?:\d+[.)]\s*)?(?:bắt đầu\s+|bat dau\s+)?(?:bài|bai)\s+(\d+)\s*[:：.\-]\s*(.+)$/i;
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

  const lesson = normalizeLessonStart(topic);
  if (lesson) return lesson;

  return `Em muốn ôn tập phần "${topic}" từ improve plan. Hãy hướng dẫn em từng bước trong đoạn chat này, giải thích dễ hiểu, có ví dụ nhỏ và gợi ý em nên tự kiểm tra gì tiếp theo.`;
}
