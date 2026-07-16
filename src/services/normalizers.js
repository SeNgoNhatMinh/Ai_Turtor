import { getPersonDisplayName } from '../utils/displayNames.js';
import { hasBrokenTextEncoding, repairMojibake } from '../utils/textEncoding.js';

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
  const repairedTitle = repairMojibake(session.title).trim();

  return {
    ...session,
    id: session.id || session.conversationId,
    title: !repairedTitle || hasBrokenTextEncoding(repairedTitle) ? 'Cuộc trò chuyện mới' : repairedTitle,
    createdAt: session.createdAt || session.lastMessageAt || session.updatedAt || new Date().toISOString(),
    lastMessageAt: session.lastMessageAt || session.updatedAt || session.lastMessageTime || session.createdAt || new Date().toISOString(),
    messageCount,
    userQuestionCount,
    maxTurnsReached: isFull,
  };
};

export const pairMessages = (messages) => {
  const arr = Array.isArray(messages) ? messages : [];
  const paired = [];
  
  for (let i = 0; i < arr.length; i++) {
    const msg = arr[i];
    const role = String(msg.role || '').toUpperCase();
    if (role === 'USER' || role === 'STUDENT') {
      const nextMsg = arr[i + 1];
      if (nextMsg && String(nextMsg.role || '').toUpperCase() === 'ASSISTANT') {
        paired.push({
          id: msg.id || msg.messageId || nextMsg.id || nextMsg.messageId,
          userMessageId: msg.id || msg.messageId,
          assistantMessageId: nextMsg.id || nextMsg.messageId,
          question: msg.content || msg.question || msg.message || '',
          answer: nextMsg.content || nextMsg.answer || nextMsg.response || '',
          confidence: nextMsg.confidence,
          mode: nextMsg.mode || nextMsg.answerMode || 'RAG',
          sources: nextMsg.sources || [],
          nextImproveSuggestions: asArray(
            nextMsg.nextImproveSuggestions || nextMsg.improveSuggestions || nextMsg.suggestions,
          ),
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
    } else if (role === 'ASSISTANT') {
      paired.push({
        id: msg.id || msg.messageId,
        question: '',
        answer: msg.content || msg.answer || msg.response || '',
        confidence: msg.confidence,
        mode: msg.mode || msg.answerMode || 'RAG',
        sources: msg.sources || [],
        nextImproveSuggestions: asArray(
          msg.nextImproveSuggestions || msg.improveSuggestions || msg.suggestions,
        ),
        questionEscalationId: msg.questionEscalationId || null,
        createdAt: msg.createdAt
      });
    } else {
      paired.push({
        id: msg.id || msg.messageId,
        question: msg.question || msg.content || '',
        answer: msg.answer || '',
        confidence: msg.confidence,
        mode: msg.mode || msg.answerMode || 'RAG',
        sources: msg.sources || [],
        nextImproveSuggestions: asArray(
          msg.nextImproveSuggestions || msg.improveSuggestions || msg.suggestions,
        ),
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
  questionPreview: escalation.questionPreview || escalation.question || escalation.originalQuestion || escalation.title || 'Support request',
  createdAt: escalation.createdAt || escalation.updatedAt || new Date().toISOString(),
  status: escalation.status || 'PENDING',
  originalQuestion: escalation.originalQuestion || escalation.question || escalation.questionPreview || '',
  question: escalation.originalQuestion || escalation.question || escalation.questionPreview || '',
  aiResponse: escalation.aiResponse || escalation.aiAnswer || escalation.answerSnapshot || '',
  mentorAnswer: escalation.mentorAnswer || escalation.teacherAnswer || escalation.response || escalation.mentorResponse || '',
  assignedMentorName: escalation.assignedMentorName || escalation.mentorName || escalation.teacherName || '',
});

export const normalizeTeacherInboxItem = (item) => ({
  ...item,
  id: item.id || item.questionEscalationId || item.escalationId,
  student: getPersonDisplayName(item, 'Student'),
  title: item.questionPreview || item.question || item.title || 'Support request',
  context: [item.courseId && `Course: ${item.courseId}`, item.classId && `Class: ${item.classId}`].filter(Boolean).join(' | ') || '—',
  time: item.waitingSince || item.waitingTime || item.createdAt || '',
  status: (item.status || 'PENDING').toLowerCase(),
  originalQuestion: item.originalQuestion || item.question || item.questionPreview || '',
  question: item.originalQuestion || item.question || item.questionPreview || '',
});

export const normalizeAnswerReview = (review) => ({
  ...review,
  id: review.id || review.reviewId,
  studentId: review.studentId || review.userId || '',
  studentName: getPersonDisplayName(review, 'Student'),
  studentEmail: review.studentEmail || review.email || '',
  courseId: review.courseId || '',
  classId: review.classId || '',
  question: review.question || review.studentQuestion || '—',
  answer: review.answer || review.aiAnswer || review.mentorAnswer || '—',
  status: review.status || 'SUBMITTED',
  reviewType: review.reviewType || review.type || 'ANSWER_DISPUTE',
  rating: Number.isFinite(Number(review.rating)) ? Number(review.rating) : null,
  accurate: typeof review.accurate === 'boolean' ? review.accurate : null,
  helpful: typeof review.helpful === 'boolean' ? review.helpful : null,
  feedback: review.feedback || review.comment || review.reviewText || '',
  suggestedCorrection: review.suggestedCorrection || review.correction || '',
  createdAt: review.createdAt || review.submittedAt || review.updatedAt || '',
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
    } catch {
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

export const normalizeTeacherQuizAttempt = (attempt) => ({
  ...(attempt || {}),
  id: attempt?.quizSessionId || attempt?.id || attempt?.sessionId,
  quizSessionId: attempt?.quizSessionId || attempt?.id || attempt?.sessionId,
  assignmentId: attempt?.assignmentId || '',
  studentId: attempt?.studentId || '',
  teacherId: attempt?.teacherId || '',
  courseId: attempt?.courseId || '',
  classId: attempt?.classId || '',
  title: attempt?.title || attempt?.topic || 'Assigned quiz',
  topic: attempt?.topic || attempt?.title || '',
  quizType: attempt?.quizType || 'ASSIGNED',
  status: attempt?.status || 'SUBMITTED',
  teacherReviewStatus: attempt?.teacherReviewStatus || attempt?.reviewStatus || 'PENDING',
  score: attempt?.autoScore ?? attempt?.score ?? 0,
  autoScore: attempt?.autoScore ?? attempt?.score ?? 0,
  teacherReviewedScore: attempt?.teacherReviewedScore ?? attempt?.reviewedScore ?? null,
  finalScore: attempt?.finalScore ?? attempt?.teacherReviewedScore ?? attempt?.autoScore ?? attempt?.score ?? 0,
  maxScore: attempt?.maxScore ?? 0,
  percentage: attempt?.autoPercentage ?? attempt?.percentage ?? null,
  autoPercentage: attempt?.autoPercentage ?? attempt?.percentage ?? null,
  finalPercentage: attempt?.finalPercentage ?? attempt?.autoPercentage ?? attempt?.percentage ?? null,
  teacherFeedback: attempt?.teacherFeedback || '',
  createdAt: attempt?.createdAt || '',
  submittedAt: attempt?.submittedAt || '',
  teacherReviewedAt: attempt?.teacherReviewedAt || '',
  questions: asArray(attempt?.questions),
  answers: asArray(attempt?.answers),
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

export const normalizeCourseMaterial = (material = {}) => {
  const title = material.title || material.name || 'Untitled Material';
  const sourceFileName = material.sourceFileName
    || material.fileName
    || material.filename
    || material.originalFileName
    || '';

  return {
    ...material,
    id: material.id || material.materialId,
    title,
    sourceFileName,
    fileName: sourceFileName || title,
    status: material.indexingStatus || material.status || material.indexStatus || 'INDEXED',
  };
};
