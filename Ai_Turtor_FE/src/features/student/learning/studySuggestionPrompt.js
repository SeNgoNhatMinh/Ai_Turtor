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

export function buildStudySuggestionPrompt(suggestionText) {
  const topic = String(suggestionText || '').trim();
  if (!topic) return '';

  const lesson = normalizeLessonStart(topic);
  if (lesson) return lesson;

  return `Em muốn ôn tập phần "${topic}" từ improve plan. Hãy hướng dẫn em từng bước trong đoạn chat này, giải thích dễ hiểu, có ví dụ nhỏ và gợi ý em nên tự kiểm tra gì tiếp theo.`;
}
