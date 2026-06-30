export const asArray = (data, ...keys) => {
  if (Array.isArray(data)) return data;
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
};

const CHAT_TURN_LIMIT = 10;

const toFiniteNumber = (value, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

export const normalizeSession = (session = {}) => {
  const messageCount = toFiniteNumber(session.messageCount ?? session.messagesCount ?? session.totalMessages, 0);
  const userQuestionCount = toFiniteNumber(
    session.userQuestionCount ?? session.questionCount ?? session.userTurnCount,
    Math.floor(messageCount / 2),
  );
  const isFull = Boolean(session.maxTurnsReached ?? session.turnLimitReached ?? userQuestionCount >= CHAT_TURN_LIMIT);

  return {
    ...session,
    id: session.id || session.conversationId,
    title: !session.title || session.title.includes('�') ? 'New conversation' : session.title,
    createdAt: session.createdAt || session.lastMessageAt || session.updatedAt || new Date().toISOString(),
    lastMessageAt: session.lastMessageAt || session.updatedAt || session.lastMessageTime || session.createdAt || new Date().toISOString(),
    messageCount,
    userQuestionCount,
    maxTurnsReached: isFull,
  };
};

export const normalizeMessage = (message) => ({
  ...message,
  question: message.question || message.userMessage || message.message || message.content || '',
  answer: message.answer || message.aiResponse || message.response || '',
});

export const pairMessages = (messages) => {
  const arr = Array.isArray(messages) ? messages : [];
  const paired = [];
  
  for (let i = 0; i < arr.length; i++) {
    const msg = arr[i];
    if (msg.role === 'USER') {
      const nextMsg = arr[i + 1];
      if (nextMsg && nextMsg.role === 'ASSISTANT') {
        paired.push({
          id: msg.id || msg.messageId || nextMsg.id || nextMsg.messageId,
          userMessageId: msg.id || msg.messageId,
          assistantMessageId: nextMsg.id || nextMsg.messageId,
          question: msg.content || msg.question || msg.message || '',
          answer: nextMsg.content || nextMsg.answer || nextMsg.response || '',
          confidence: nextMsg.confidence,
          sources: nextMsg.sources || [],
          questionEscalationId: nextMsg.questionEscalationId || null,
          createdAt: msg.createdAt || nextMsg.createdAt
        });
        i++;
      } else {
        paired.push({
          id: msg.id || msg.messageId,
          question: msg.content || msg.question || msg.message || '',
          answer: '',
          createdAt: msg.createdAt
        });
      }
    } else if (msg.role === 'ASSISTANT') {
      paired.push({
        id: msg.id || msg.messageId,
        question: '',
        answer: msg.content || msg.answer || msg.response || '',
        confidence: msg.confidence,
        sources: msg.sources || [],
        questionEscalationId: msg.questionEscalationId || null,
        createdAt: msg.createdAt
      });
    } else {
      paired.push({
        id: msg.id || msg.messageId,
        question: msg.question || msg.content || '',
        answer: msg.answer || '',
        confidence: msg.confidence,
        sources: msg.sources || [],
        questionEscalationId: msg.questionEscalationId || null,
        createdAt: msg.createdAt
      });
    }
  }
  return paired;
};

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

export const normalizeSuggestions = (data) => {
  if (!data) return [];
  const list = [];

  // 1. Process ruleSuggestions
  const ruleSuggestions = asArray(data?.ruleSuggestions || data?.suggestions);
  ruleSuggestions.forEach(item => {
    const isWeak = item.title?.toLowerCase().includes('weak') || item.reason?.toLowerCase().includes('weak');
    list.push({
      priority: isWeak ? 'high' : 'medium',
      title: item.title || 'Study Suggestion',
      content: (item.reason || '') + 
        (item.nextSteps && item.nextSteps.length 
          ? '\n\nSuggested steps:\n' + item.nextSteps.map(s => `• ${s}`).join('\n') 
          : '')
    });
  });

  // 2. Process aiSuggestion
  if (data?.aiSuggestion) {
    try {
      const parsed = typeof data.aiSuggestion === 'string' 
        ? JSON.parse(data.aiSuggestion) 
        : data.aiSuggestion;
      const aiItems = asArray(parsed?.suggestions);
      aiItems.forEach(item => {
        list.push({
          priority: 'medium',
          title: item.title || 'AI Suggestion',
          content: (item.reason || item.content || '') + 
            (item.nextSteps && item.nextSteps.length 
              ? '\n\nSuggested steps:\n' + item.nextSteps.map(s => `• ${s}`).join('\n') 
              : '')
        });
      });
    } catch (e) {
      // If it's not JSON, treat it as a single suggestion content
      list.push({
        priority: 'medium',
        title: 'AI Learning Analysis',
        content: String(data.aiSuggestion)
      });
    }
  }

  return list;
};

export const normalizeStudentDashboard = (data) => {
  const topics = (key, alt) => {
    const arr = asArray(data, key, alt, 'content');
    if (arr.length) return arr.map((t) => (typeof t === 'string' ? t : t.topic || t.name || t.label)).filter(Boolean);
    return [];
  };

  const memoriesList = asArray(data?.memories || data?.memory);
  const learnedTopics = memoriesList.flatMap(m => asArray(m?.learnedTopics || m?.strongTopics));
  const weakTopics = memoriesList.flatMap(m => asArray(m?.weakTopics || m?.weakAreas));

  const stats = data?.stats || data?.summary || {
    activeCourses: asArray(data?.enrollments).length || 0,
    totalAssignments: asArray(data?.assignments).length || 0,
    submittedTasks: asArray(data?.submissions).length || 0,
    supportRequests: asArray(data?.escalations).length || 0,
  };

  // Extract from improvePlans
  const plansList = asArray(data?.improvePlans || data?.plans || data?.improvePlan);
  const planSuggestions = plansList.map(plan => ({
    priority: String(plan.riskLevel || '').toLowerCase() === 'high' ? 'high' : 'medium',
    title: plan.weakTopics?.length 
      ? `Improvement Plan: ${plan.weakTopics.join(', ')}` 
      : 'AI Learning Improvement Plan',
    content: asArray(plan.planItems).join('\n') || 'Practice and review focus areas.'
  }));

  // Extract from memory suggestions
  const memorySuggestions = memoriesList.flatMap(m => asArray(m?.improveSuggestions || m?.suggestions)).map(s => {
    if (typeof s === 'object' && s !== null) {
      return {
        priority: s.priority || 'medium',
        title: s.title || 'Study Suggestion',
        content: s.content || s.reason || ''
      };
    }
    return {
      priority: 'high',
      title: 'Course Suggestion / Feedback',
      content: String(s)
    };
  });

  const suggestions = [...planSuggestions, ...memorySuggestions];
  const pinnedImproveSuggestions = [
    ...memoriesList.flatMap(m => asArray(m?.pinnedImproveSuggestions)),
    ...asArray(data?.pinnedImproveSuggestions),
  ].filter(Boolean);
  const primaryMemory = memoriesList[0] || data?.memory || data || {};

  return {
    learnedTopics: learnedTopics.length ? learnedTopics : topics('learnedTopics', 'strongTopics'),
    weakTopics: weakTopics.length ? weakTopics : topics('weakTopics', 'weakAreas'),
    suggestions: suggestions.length ? suggestions : (data?.suggestions || data?.improveSuggestions || []),
    pinnedImproveSuggestions: [...new Set(pinnedImproveSuggestions)],
    stats: stats,
    summary: primaryMemory?.summary || data?.memorySummary || '',
    classId: primaryMemory?.classId || data?.classId || '',
    recentQuestions: asArray(primaryMemory?.recentQuestions || data?.recentQuestions),
    recentAnswers: asArray(primaryMemory?.recentAnswers || data?.recentAnswers),
    updatedAt: primaryMemory?.updatedAt || data?.updatedAt || '',
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

export const normalizeQuizSession = (quiz) => ({
  ...(quiz || {}),
  id: quiz?.id || quiz?.quizSessionId || quiz?.sessionId,
  quizSessionId: quiz?.quizSessionId || quiz?.sessionId || quiz?.id,
  title: quiz?.title || quiz?.topic || 'Practice quiz',
  topic: quiz?.topic || quiz?.title || '',
  status: quiz?.status || 'GENERATED',
  quizType: quiz?.quizType || quiz?.type || 'SELF_PRACTICE',
  score: quiz?.score ?? quiz?.autoScore ?? 0,
  maxScore: quiz?.maxScore ?? quiz?.totalScore ?? asArray(quiz?.questions).length,
  percentage: quiz?.percentage ?? null,
  questions: asArray(quiz?.questions),
  answers: asArray(quiz?.answers),
  teacherReviewStatus: quiz?.teacherReviewStatus || quiz?.reviewStatus || '',
  teacherReviewedScore: quiz?.teacherReviewedScore ?? quiz?.reviewedScore,
  teacherFeedback: quiz?.teacherFeedback || quiz?.feedback || '',
  createdAt: quiz?.createdAt || new Date().toISOString(),
  submittedAt: quiz?.submittedAt || '',
  updatedAt: quiz?.updatedAt || quiz?.submittedAt || quiz?.createdAt || new Date().toISOString(),
});

export const normalizeQuizAssignment = (assignment) => ({
  ...(assignment || {}),
  id: assignment?.id || assignment?.assignmentId,
  assignmentId: assignment?.assignmentId || assignment?.id,
  title: assignment?.title || assignment?.name || assignment?.topic || 'Untitled Quiz',
  topic: assignment?.topic || assignment?.title || '',
  status: assignment?.status || 'DRAFT',
  targetType: assignment?.targetType || 'CLASS',
  classId: assignment?.classId || '',
  publishedAt: assignment?.publishedAt || '',
  questionCount: assignment?.questionCount ?? asArray(assignment?.questions).length,
  questions: asArray(assignment?.questions),
});

export const normalizeImprovePlan = (plan) => ({
  ...(plan || {}),
  id: plan?.id || plan?.planId,
  planId: plan?.planId || plan?.id,
  riskLevel: plan?.riskLevel || 'LOW',
  status: plan?.status || 'ACTIVE',
  weakTopics: asArray(plan?.weakTopics),
  planItems: asArray(plan?.planItems || plan?.items),
  evidence: asArray(plan?.evidence),
  generatedAt: plan?.generatedAt || plan?.createdAt || '',
  updatedAt: plan?.updatedAt || plan?.generatedAt || plan?.createdAt || '',
});

export const normalizeEnrollment = (enrollment) => ({
  ...enrollment,
  id: enrollment.id || enrollment.enrollmentId,
  status: enrollment.status || 'ACTIVE',
  studentName: enrollment.studentName || enrollment.studentFullName || 'Student',
});

export const normalizeCourseMaterial = (material) => ({
  ...material,
  id: material.id || material.materialId,
  title: material.title || material.name || 'Untitled Material',
  status: material.status || material.indexStatus || 'INDEXED',
});
