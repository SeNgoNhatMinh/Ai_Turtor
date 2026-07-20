const normalizeKey = (value) => String(value || '').trim().toLocaleLowerCase();

const getTopicText = (value) => String(
  value?.title || value?.topic || value?.name || value?.content || value || '',
).trim();

const getSuggestionDescription = (suggestion, title) => {
  const content = String(suggestion?.content || '').trim();
  return content && normalizeKey(content) !== normalizeKey(title) ? content : '';
};

const uniqueTopicNames = (topics) => {
  const seen = new Set();
  return (Array.isArray(topics) ? topics : []).reduce((result, topic) => {
    const title = getTopicText(topic);
    const key = normalizeKey(title);
    if (!key || seen.has(key)) return result;
    seen.add(key);
    result.push(title);
    return result;
  }, []);
};

export function buildLearningActionPlan({
  learnedTopics = [],
  weakTopics = [],
  suggestions = [],
  consumedSuggestionKeys = [],
  maxFocusItems = 6,
} = {}) {
  const learned = uniqueTopicNames(learnedTopics);
  const weak = uniqueTopicNames(weakTopics);
  const learnedKeys = new Set(learned.map(normalizeKey));
  const focusMap = new Map();
  const consumedKeys = new Set((consumedSuggestionKeys || []).map(normalizeKey));

  weak.forEach((title) => {
    const key = normalizeKey(title);
    focusMap.set(key, {
      id: `weak:${key}`,
      title,
      status: 'weak',
      priority: 1,
      pinned: false,
      description: 'Được ghi nhận là nội dung cần tập trung từ bộ nhớ học tập hoặc kết quả quiz.',
    });
  });

  (Array.isArray(suggestions) ? suggestions : []).forEach((suggestion) => {
    const title = getTopicText(suggestion);
    const key = normalizeKey(title);
    if (!key || (learnedKeys.has(key) && !focusMap.has(key))) return;
    if (consumedKeys.has(key) && !focusMap.has(key)) return;

    const pinned = String(suggestion?.priority || '').toLowerCase() === 'pinned';
    const current = focusMap.get(key);
    if (current) {
      focusMap.set(key, {
        ...current,
        pinned: current.pinned || pinned,
        priority: pinned ? 0 : current.priority,
        description: getSuggestionDescription(suggestion, title) || current.description,
      });
      return;
    }

    focusMap.set(key, {
      id: `suggestion:${key}`,
      title,
      status: 'recommended',
      priority: pinned ? 0 : String(suggestion?.priority || '').toLowerCase() === 'high' ? 2 : 3,
      pinned,
      description: getSuggestionDescription(suggestion, title) || 'Được đề xuất từ hoạt động học tập gần đây của bạn.',
    });
  });

  const focusItems = [...focusMap.values()]
    .sort((left, right) => left.priority - right.priority || left.title.localeCompare(right.title))
    .slice(0, Math.max(1, maxFocusItems));
  const focusKeys = new Set(focusItems.map((item) => normalizeKey(item.title)));

  return {
    focusItems,
    masteredTopics: learned.filter((topic) => !focusKeys.has(normalizeKey(topic))),
    counts: {
      focus: focusItems.length,
      weak: weak.length,
      mastered: learned.length,
    },
  };
}
