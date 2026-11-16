/** Student-friendly labels for how AI currently teaches. */

export const AI_SUPPORT_TITLE = 'Cách AI hỗ trợ bạn học';
export const AI_SUPPORT_DESCRIPTION =
  'AI điều chỉnh cách giải thích và bài tập dựa trên quá trình học tập của bạn.';
export const AI_SUPPORT_TRANSPARENCY =
  'AI sử dụng kết quả học tập và nhận xét của giảng viên để hỗ trợ bạn tốt hơn.';

export const APPROACH_KEYS = {
  STEP_BY_STEP: 'step_by_step',
  GUIDED_PRACTICE: 'guided_practice',
  CHALLENGE: 'challenge',
};

const APPROACH_BASE = {
  [APPROACH_KEYS.STEP_BY_STEP]: {
    key: APPROACH_KEYS.STEP_BY_STEP,
    title: 'Giải thích từng bước',
    fallback: 'Chia nội dung thành các bước nhỏ, dễ theo dõi.',
  },
  [APPROACH_KEYS.GUIDED_PRACTICE]: {
    key: APPROACH_KEYS.GUIDED_PRACTICE,
    title: 'Luyện tập có hướng dẫn',
    fallback: 'Cho bài tập kèm gợi ý, giúp bạn tự làm dần.',
  },
  [APPROACH_KEYS.CHALLENGE]: {
    key: APPROACH_KEYS.CHALLENGE,
    title: 'Thử thách kiến thức',
    fallback: 'Tăng độ khó và khuyến khích bạn tự suy luận hơn.',
  },
};

const STEP_MARKERS = /giải thích|từng bước|step[_\s-]?by[_\s-]?step|ví dụ|minh họa|so sánh|khái niệm|code walk|trực quan|cụ thể đến/i;
const PRACTICE_MARKERS = /luyện tập|thực hành|hướng dẫn|guided|bài tập|gợi mở|socratic|sửa hiểu|gợi nhớ|retrieval/i;
const CHALLENGE_MARKERS = /thử thách|challenge|độc lập|independent|tự giải/i;

function asList(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function unique(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function behaviorText(behavior) {
  return [
    behavior?.strategyCode,
    behavior?.strategy,
    behavior?.displayName,
    behavior?.title,
    behavior?.instruction,
  ].filter(Boolean).join(' ');
}

function classifyBehavior(behavior) {
  const text = behaviorText(behavior);
  const code = String(behavior?.strategyCode || behavior?.code || '').toUpperCase();
  if (
    code.includes('CHALLENGE')
    || code.includes('INDEPENDENT')
    || CHALLENGE_MARKERS.test(text)
  ) return APPROACH_KEYS.CHALLENGE;
  if (
    code.includes('GUIDED')
    || code.includes('PRACTICE')
    || code.includes('SOCRATIC')
    || code.includes('RETRIEVAL')
    || code.includes('MISCONCEPTION')
    || PRACTICE_MARKERS.test(text)
  ) return APPROACH_KEYS.GUIDED_PRACTICE;
  if (
    code.includes('STEP')
    || code.includes('VISUAL')
    || code.includes('COMPARE')
    || code.includes('CONCRETE')
    || code.includes('CODE')
    || STEP_MARKERS.test(text)
  ) return APPROACH_KEYS.STEP_BY_STEP;
  return APPROACH_KEYS.STEP_BY_STEP;
}

function normalizeSupportLevel(level) {
  const value = String(level || '').trim().toUpperCase();
  if (value === 'HIGH_SUPPORT' || value === 'CHALLENGE' || value === 'STANDARD') return value;
  return '';
}

function formatUpdatedAt(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Build learning overview only from provided evidence fields.
 * Missing sections become empty arrays (UI shows empty state).
 */
export function buildLearningOverview({
  masteredTopics,
  improveTopics,
  recentResults,
  updatedAt,
} = {}) {
  return {
    masteredTopics: unique(asList(masteredTopics)),
    improveTopics: unique(asList(improveTopics)),
    recentResults: unique(asList(recentResults)),
    updatedAt: formatUpdatedAt(updatedAt),
  };
}

function approachFromSupportLevel(supportLevel) {
  const level = normalizeSupportLevel(supportLevel);
  if (level === 'HIGH_SUPPORT') {
    return [APPROACH_KEYS.STEP_BY_STEP, APPROACH_KEYS.GUIDED_PRACTICE];
  }
  if (level === 'CHALLENGE') {
    return [APPROACH_KEYS.CHALLENGE, APPROACH_KEYS.STEP_BY_STEP];
  }
  if (level === 'STANDARD') {
    return [APPROACH_KEYS.STEP_BY_STEP, APPROACH_KEYS.GUIDED_PRACTICE];
  }
  return [];
}

function describeApproach(key, { improveTopics, masteredTopics, notes } = {}) {
  const base = APPROACH_BASE[key];
  if (!base) return null;
  const improve = asList(improveTopics).slice(0, 2);
  const mastered = asList(masteredTopics).slice(0, 2);
  const extra = asList(notes).slice(0, 1);
  if (key === APPROACH_KEYS.STEP_BY_STEP && improve.length) {
    return {
      ...base,
      description: `Giải thích chậm và rõ hơn với chủ đề bạn đang cần củng cố: ${improve.join(', ')}.`,
      active: true,
    };
  }
  if (key === APPROACH_KEYS.GUIDED_PRACTICE && improve.length) {
    return {
      ...base,
      description: `Cho bài tập có hướng dẫn quanh: ${improve.join(', ')}.`,
      active: true,
    };
  }
  if (key === APPROACH_KEYS.CHALLENGE && mastered.length) {
    return {
      ...base,
      description: `Thử thách thêm trên phần bạn đã nắm: ${mastered.join(', ')}.`,
      active: true,
    };
  }
  if (extra.length) {
    return { ...base, description: extra[0], active: true };
  }
  return { ...base, description: base.fallback, active: true };
}

/**
 * Derive the three student-facing teaching approaches from active strategies
 * and/or support level. Never invent topics — only use provided evidence.
 */
export function buildTeachingApproaches({
  behaviors = [],
  supportLevel = '',
  masteredTopics = [],
  improveTopics = [],
} = {}) {
  const activeBehaviors = (Array.isArray(behaviors) ? behaviors : [])
    .filter((item) => item && !['RETIRED', 'REJECTED'].includes(String(item.status || '').toUpperCase()));

  const bucketNotes = {
    [APPROACH_KEYS.STEP_BY_STEP]: [],
    [APPROACH_KEYS.GUIDED_PRACTICE]: [],
    [APPROACH_KEYS.CHALLENGE]: [],
  };
  const activeKeys = new Set();

  activeBehaviors.forEach((behavior) => {
    const key = classifyBehavior(behavior);
    activeKeys.add(key);
    const note = String(behavior.instruction || behavior.title || '').trim();
    if (note && bucketNotes[key].length < 1) bucketNotes[key].push(note);
  });

  if (activeKeys.size === 0) {
    approachFromSupportLevel(supportLevel).forEach((key) => activeKeys.add(key));
  }

  const level = normalizeSupportLevel(supportLevel);
  const ordered = (
    level === 'CHALLENGE'
      ? [
        APPROACH_KEYS.CHALLENGE,
        APPROACH_KEYS.STEP_BY_STEP,
        APPROACH_KEYS.GUIDED_PRACTICE,
      ]
      : [
        APPROACH_KEYS.STEP_BY_STEP,
        APPROACH_KEYS.GUIDED_PRACTICE,
        APPROACH_KEYS.CHALLENGE,
      ]
  ).filter((key) => activeKeys.has(key));

  return ordered
    .map((key) => describeApproach(key, {
      improveTopics,
      masteredTopics,
      notes: bucketNotes[key],
    }))
    .filter(Boolean);
}

export function supportLevelPlainLabel(level) {
  const value = normalizeSupportLevel(level);
  if (value === 'HIGH_SUPPORT') return 'Hỗ trợ nhiều';
  if (value === 'CHALLENGE') return 'Thử thách';
  if (value === 'STANDARD') return 'Bình thường';
  return '';
}
