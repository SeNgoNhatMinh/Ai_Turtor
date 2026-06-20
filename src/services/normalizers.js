export const asArray = (data, ...keys) => {
  if (Array.isArray(data)) return data;
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
};

export const normalizeSession = (session) => ({
  ...session,
  id: session.id || session.conversationId,
  title: !session.title || session.title.includes('�') ? 'New conversation' : session.title,
  createdAt: session.createdAt || session.lastMessageAt || new Date().toISOString(),
});

export const normalizeMessage = (message) => ({
  ...message,
  question: message.question || message.userMessage || message.message || message.content || '',
  answer: message.answer || message.aiResponse || message.response || '',
});

export const normalizeEscalation = (escalation) => ({
  ...escalation,
  id: escalation.id || escalation.questionEscalationId,
  questionPreview: escalation.questionPreview || escalation.question || escalation.title || 'Support request',
  createdAt: escalation.createdAt || escalation.updatedAt || new Date().toISOString(),
  status: escalation.status || 'PENDING',
});

export const normalizeTeacherInboxItem = (item) => ({
  ...item,
  id: item.id || item.questionEscalationId || item.escalationId,
  student: item.studentName || item.studentFullName || item.studentId || 'Student',
  title: item.questionPreview || item.question || item.title || 'Support request',
  context: [item.courseId && `Course: ${item.courseId}`, item.classId && `Class: ${item.classId}`].filter(Boolean).join(' | ') || '—',
  time: item.waitingSince || item.waitingTime || item.createdAt || '',
  status: (item.status || 'PENDING').toLowerCase(),
  question: item.question || item.questionPreview || '',
  chatRoomId: item.chatRoomId,
});

export const normalizeAnswerReview = (review) => ({
  ...review,
  id: review.id || review.reviewId,
  question: review.question || review.studentQuestion || '—',
  answer: review.answer || review.aiAnswer || review.mentorAnswer || '—',
  status: review.status || 'SUBMITTED',
  reviewType: review.reviewType || review.type || 'ANSWER_DISPUTE',
});

export const normalizeStudentDashboard = (data) => {
  const topics = (key, alt) => {
    const arr = asArray(data, key, alt, 'content');
    if (arr.length) return arr.map((t) => (typeof t === 'string' ? t : t.topic || t.name || t.label)).filter(Boolean);
    return [];
  };
  return {
    learnedTopics: topics('learnedTopics', 'strongTopics'),
    weakTopics: topics('weakTopics', 'weakAreas'),
    suggestions: data?.suggestions || data?.improveSuggestions || [],
    stats: data?.stats || data?.summary || {},
  };
};

export const normalizeTeacherDashboard = (data) => {
  const mapTopic = (t) => {
    if (typeof t === 'string') return { label: t, level: 'none' };
    return {
      label: t.topic || t.name || t.label || '—',
      level: (t.level || t.risk || t.severity || 'none').toLowerCase(),
    };
  };
  const heatmap = asArray(data, 'topicHeatmap', 'weakTopics', 'knowledgeGaps', 'content');
  return {
    classSections: asArray(data, 'classSections', 'classes', 'content'),
    students: asArray(data, 'students', 'enrolledStudents', 'classStudents', 'content'),
    topicHeatmap: heatmap.length ? heatmap.map(mapTopic) : [],
    stats: data?.stats || data?.summary || {},
  };
};
