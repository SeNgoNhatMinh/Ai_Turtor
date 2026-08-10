import { getPersonDisplayName } from '../utils/displayNames.js';
import { extractAnswerSourceLabels } from '../utils/sourceLabels.js';
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

const getMessageContent = (message = {}) => (
  message.content || message.answer || message.response || ''
);

const getMessageSources = (message = {}) => {
  const explicitSources = [
    ...asArray(message.sources),
    ...asArray(message.sourceMaterials),
    ...asArray(message.materialSources),
    ...asArray(message.metadata?.sources),
  ];
  const sourceIds = asArray(message.sourceMaterialIds || message.materialIds);
  const recoveredLabels = extractAnswerSourceLabels(getMessageContent(message));
  return [...explicitSources, ...sourceIds, ...recoveredLabels];
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
          answer: getMessageContent(nextMsg),
          confidence: nextMsg.confidence,
          mode: nextMsg.mode || nextMsg.answerMode || 'RAG',
          sources: getMessageSources(nextMsg),
          sourceEvidence: asArray(nextMsg.sourceEvidence),
          groundingType: nextMsg.groundingType || null,
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
        answer: getMessageContent(msg),
        confidence: msg.confidence,
        mode: msg.mode || msg.answerMode || 'RAG',
        sources: getMessageSources(msg),
        sourceEvidence: asArray(msg.sourceEvidence),
        groundingType: msg.groundingType || null,
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
        sources: getMessageSources(msg),
        sourceEvidence: asArray(msg.sourceEvidence),
        groundingType: msg.groundingType || null,
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
  aiResponse: item.aiResponse || item.aiAnswer || item.answerSnapshot || '',
  mentorAnswer: item.mentorAnswer || item.teacherAnswer || item.officialAnswer || item.response || item.mentorResponse || '',
  assignedMentorName: item.assignedMentorName || item.mentorName || item.teacherName || '',
  resolvedAt: item.resolvedAt || item.answeredAt || item.updatedAt || '',
});

const normalizeAnswerReviewEvidence = (item) => ({
  reviewId: item?.reviewId || item?.id || '',
  studentId: item?.studentId || '',
  rating: Number.isFinite(Number(item?.rating)) ? Number(item.rating) : null,
  accurate: typeof item?.accurate === 'boolean' ? item.accurate : null,
  helpful: typeof item?.helpful === 'boolean' ? item.helpful : null,
  reviewType: item?.reviewType || '',
  feedback: item?.feedback || '',
  suggestedCorrection: item?.suggestedCorrection || '',
  createdAt: item?.createdAt || '',
});

export const normalizeGroupedAnswerReview = (group) => {
  const evidence = asArray(group?.reviews).map(normalizeAnswerReviewEvidence);
  const representative = normalizeAnswerReview({
    id: group?.representativeReviewId || evidence[0]?.reviewId,
    courseId: group?.courseId,
    classId: group?.classId,
    question: group?.question,
    answer: group?.answer,
    mode: group?.mode,
    status: group?.queueStatus || group?.status,
    reviewType: evidence[0]?.reviewType,
    rating: group?.averageRating != null ? Math.round(Number(group.averageRating)) : evidence[0]?.rating,
    aiConfidence: group?.aiConfidence,
    escalationTier: group?.escalationTier,
    answerFingerprint: group?.answerFingerprint,
    createdAt: group?.lastReportedAt || group?.firstReportedAt,
  });
  return {
    ...representative,
    answerFingerprint: group?.answerFingerprint || '',
    escalationTier: group?.escalationTier || '',
    queueStatus: group?.queueStatus || group?.status || representative.status,
    distinctStudentCount: Number(group?.distinctStudentCount) || 0,
    reviewCount: Number(group?.reviewCount) || evidence.length,
    averageRating: Number.isFinite(Number(group?.averageRating))
      ? Number(group.averageRating)
      : null,
    firstReportedAt: group?.firstReportedAt || '',
    lastReportedAt: group?.lastReportedAt || '',
    representativeReviewId: group?.representativeReviewId || representative.id,
    evidence,
  };
};

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
  resolvedAt: review.resolvedAt || review.reviewedAt || review.updatedAt || '',
  resolvedByName: review.resolvedByName || review.seniorReviewerName || review.reviewerName || review.teacherName || '',
  resolutionNote: review.resolutionNote || review.reviewNote || review.notes || '',
  correctedAnswer: review.correctedAnswer || review.correctedContent || '',
  linkedKnowledgeCandidateId: review.linkedKnowledgeCandidateId || review.knowledgeCandidateId || '',
});

const parseSuggestionJson = (value) => {
  if (!value || typeof value !== 'string') return null;
  const text = value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    const firstObjectIndex = text.indexOf('{');
    const lastObjectIndex = text.lastIndexOf('}');
    if (firstObjectIndex < 0 || lastObjectIndex <= firstObjectIndex) return null;
    try {
      return JSON.parse(text.slice(firstObjectIndex, lastObjectIndex + 1));
    } catch {
      return null;
    }
  }
};

const isSuggestionEnvelope = (value) => Boolean(
  value
  && typeof value === 'object'
  && !Array.isArray(value)
  && (
    value.ruleSuggestions != null
    || value.suggestions != null
    || value.aiSuggestion != null
    || value.notes != null
  )
);

const findEmbeddedSuggestionEnvelope = (value) => {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = findEmbeddedSuggestionEnvelope(item);
      if (nested) return nested;
    }
    return null;
  }
  if (typeof value === 'string') {
    const parsed = parseSuggestionJson(value);
    if (!parsed) return null;
    if (isSuggestionEnvelope(parsed)) return parsed;
    return findEmbeddedSuggestionEnvelope(parsed);
  }
  if (typeof value !== 'object') return null;
  if (isSuggestionEnvelope(value)) return value;

  return findEmbeddedSuggestionEnvelope([
    value.content,
    value.reason,
    value.description,
    value.nextSteps,
    value.steps,
    value.actions,
  ]);
};

const normalizeSuggestionItem = (item, defaultPriority = 'medium') => {
  if (typeof item === 'string') {
    return {
      priority: defaultPriority,
      title: 'Gợi ý học tập',
      content: item.trim(),
      reason: item.trim(),
      nextSteps: [],
    };
  }

  if (!item || typeof item !== 'object') return null;
  const title = String(item.title || item.topic || 'Gợi ý học tập').trim();
  const reason = String(item.reason || item.content || item.description || '').trim();
  const nextSteps = asArray(item.nextSteps || item.steps || item.actions)
    .map((step) => String(step || '').trim())
    .filter(Boolean);
  const isWeakTopic = `${title} ${reason}`.toLowerCase().includes('weak');

  return {
    ...item,
    priority: item.priority || (isWeakTopic ? 'high' : defaultPriority),
    title,
    content: reason,
    reason,
    nextSteps: [...new Set(nextSteps)],
  };
};

export const normalizeSuggestions = (data) => {
  if (!data) return [];
  const list = [];
  const notes = new Set();

  const collect = (value, defaultPriority = 'medium') => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach((item) => collect(item, defaultPriority));
      return;
    }

    if (typeof value === 'string') {
      const parsed = parseSuggestionJson(value);
      if (parsed) {
        collect(parsed, defaultPriority);
        return;
      }
      const item = normalizeSuggestionItem(value, defaultPriority);
      if (item?.content) list.push(item);
      return;
    }

    if (typeof value !== 'object') return;
    const hasEnvelope = isSuggestionEnvelope(value);

    if (hasEnvelope) {
      collect(value.ruleSuggestions, 'medium');
      collect(value.suggestions, defaultPriority);
      collect(value.aiSuggestion, 'medium');
      if (value.notes) notes.add(String(value.notes).trim());
      return;
    }

    const embeddedEnvelope = findEmbeddedSuggestionEnvelope([
      value.content,
      value.reason,
      value.description,
      value.nextSteps,
      value.steps,
      value.actions,
    ]);
    if (embeddedEnvelope) {
      collect(embeddedEnvelope, defaultPriority);
      return;
    }

    const item = normalizeSuggestionItem(value, defaultPriority);
    if (item) list.push(item);
  };

  collect(data);
  notes.forEach((note) => {
    if (!note) return;
    list.push({
      kind: 'note',
      priority: 'info',
      title: 'Lưu ý từ AI Tutor',
      content: note,
      reason: note,
      nextSteps: [],
    });
  });

  const seen = new Set();
  return list.filter((item) => {
    const key = `${item.kind || 'suggestion'}:${item.title}:${item.content}`.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normalizeMemorySuggestions = (values) => asArray(values).flatMap((storedValue) => {
  const deleteValue = typeof storedValue === 'string'
    ? storedValue.trim()
    : JSON.stringify(storedValue);

  if (!deleteValue) return [];

  return normalizeSuggestions(storedValue).map((suggestion) => ({
    ...suggestion,
    persistence: 'BACKEND_MEMORY',
    deleteValue,
    deletable: suggestion.kind !== 'note',
  }));
});

export const normalizeStudentDashboard = (data) => {
  const topics = (key, alt) => {
    const arr = asArray(data, key, alt, 'content');
    if (arr.length) return arr.map((t) => (typeof t === 'string' ? t : t.topic || t.name || t.label)).filter(Boolean);
    return [];
  };

  const rawMemories = data?.memories || data?.memory;
  const memoriesList = Array.isArray(rawMemories)
    ? rawMemories
    : rawMemories && typeof rawMemories === 'object'
      ? [rawMemories]
      : data?.studentId && data?.courseId
        ? [data]
        : [];
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
  const planSuggestions = plansList.flatMap((plan) => {
    const embeddedEnvelope = findEmbeddedSuggestionEnvelope(plan.planItems);
    if (embeddedEnvelope) {
      return normalizeSuggestions(embeddedEnvelope).map((suggestion) => ({
        ...suggestion,
        persistence: 'IMPROVE_PLAN',
        deletable: false,
      }));
    }
    return [{
      priority: String(plan.riskLevel || '').toLowerCase() === 'high' ? 'high' : 'medium',
      title: plan.weakTopics?.length
        ? `Improvement Plan: ${plan.weakTopics.join(', ')}`
        : 'AI Learning Improvement Plan',
      content: asArray(plan.planItems).join('\n') || 'Practice and review focus areas.',
      persistence: 'IMPROVE_PLAN',
      deletable: false,
    }];
  });

  // Extract from memory suggestions
  const memorySuggestions = normalizeMemorySuggestions(
    memoriesList.flatMap((memory) => asArray(memory?.improveSuggestions || memory?.suggestions)),
  );

  const suggestions = [...planSuggestions, ...memorySuggestions];
  const pinnedImproveSuggestions = [
    ...memoriesList.flatMap(m => asArray(m?.pinnedImproveSuggestions)),
    ...asArray(data?.pinnedImproveSuggestions),
  ].filter(Boolean);
  const primaryMemory = memoriesList[0] || data?.memory || data || {};

  return {
    learnedTopics: learnedTopics.length ? learnedTopics : topics('learnedTopics', 'strongTopics'),
    weakTopics: weakTopics.length ? weakTopics : topics('weakTopics', 'weakAreas'),
    suggestions: suggestions.length
      ? suggestions
      : normalizeSuggestions(data?.suggestions || data?.improveSuggestions || []),
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

export const normalizeAssignment = (assignment) => ({
  ...(assignment || {}),
  id: assignment?.id || assignment?.assignmentId,
  assignmentId: assignment?.assignmentId || assignment?.id,
  title: assignment?.title || 'Untitled assignment',
  assignmentType: String(assignment?.assignmentType || 'ASSIGNMENT').toUpperCase(),
  maxScore: Number(assignment?.maxScore ?? 10),
  targetType: String(assignment?.targetType || 'ALL_CLASS').toUpperCase(),
  targetStudentIds: asArray(assignment?.targetStudentIds),
  answerKeyUploaded: Boolean(assignment?.answerKeyUploaded),
  attachmentFileName: assignment?.attachmentFileName || assignment?.fileName || '',
});

export const normalizeAssignmentSubmission = (submission) => ({
  ...(submission || {}),
  id: submission?.id || submission?.submissionId,
  submissionId: submission?.submissionId || submission?.id,
  assignmentId: submission?.assignmentId || submission?.assignment?.id || '',
  status: String(submission?.status || 'SUBMITTED').toUpperCase(),
  score: submission?.score ?? null,
  aiGradingStatus: String(submission?.aiGradingStatus || '').toUpperCase(),
  aiSuggestedScore: submission?.aiSuggestedScore ?? null,
  aiFeedback: submission?.aiFeedback || '',
  submittedFileName: submission?.submittedFileName || submission?.fileName || '',
});

export const normalizeQuizSession = (quiz) => ({
  ...(quiz || {}),
  id: quiz?.id || quiz?.quizSessionId || quiz?.sessionId,
  quizSessionId: quiz?.quizSessionId || quiz?.sessionId || quiz?.id,
  title: quiz?.title || quiz?.topic || 'Practice quiz',
  topic: quiz?.topic || quiz?.title || '',
  status: quiz?.status || 'GENERATED',
  quizType: quiz?.quizType || quiz?.type || 'SELF_PRACTICE',
  score: quiz?.score ?? quiz?.autoScore ?? null,
  autoScore: quiz?.autoScore ?? quiz?.score ?? null,
  maxScore: quiz?.maxScore ?? quiz?.totalScore ?? asArray(quiz?.questions).length,
  percentage: quiz?.percentage ?? null,
  questions: asArray(quiz?.questions),
  answers: asArray(quiz?.answers),
  teacherReviewStatus: quiz?.teacherReviewStatus || quiz?.reviewStatus || '',
  gradingMode: quiz?.gradingMode || quiz?.grading || '',
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
  score: attempt?.score ?? attempt?.autoScore ?? null,
  autoScore: attempt?.autoScore ?? attempt?.score ?? null,
  teacherReviewedScore: attempt?.teacherReviewedScore ?? attempt?.reviewedScore ?? null,
  finalScore: attempt?.finalScore ?? attempt?.teacherReviewedScore ?? attempt?.autoScore ?? attempt?.score ?? null,
  maxScore: attempt?.maxScore ?? 0,
  percentage: attempt?.autoPercentage ?? attempt?.percentage ?? null,
  autoPercentage: attempt?.autoPercentage ?? attempt?.percentage ?? null,
  finalPercentage: attempt?.finalPercentage ?? attempt?.autoPercentage ?? attempt?.percentage ?? null,
  teacherFeedback: attempt?.teacherFeedback || '',
  gradingMode: attempt?.gradingMode || attempt?.grading || '',
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
  suggestionText: assignment?.suggestionText || '',
  gradingMode: assignment?.gradingMode || assignment?.grading || 'AUTO',
  status: assignment?.status || 'DRAFT',
  targetType: assignment?.targetType || 'CLASS',
  classId: assignment?.classId || '',
  publishedAt: assignment?.publishedAt || '',
  questionCount: assignment?.questionCount ?? asArray(assignment?.questions).length,
  questions: asArray(assignment?.questions),
});

export const normalizeImprovePlan = (plan) => {
  const planItems = asArray(plan?.planItems || plan?.items);
  const embeddedEnvelope = findEmbeddedSuggestionEnvelope(planItems);

  return {
    ...(plan || {}),
    id: plan?.id || plan?.planId,
    planId: plan?.planId || plan?.id,
    riskLevel: plan?.riskLevel || 'LOW',
    status: plan?.status || 'ACTIVE',
    weakTopics: asArray(plan?.weakTopics),
    planItems,
    structuredSuggestions: embeddedEnvelope ? normalizeSuggestions(embeddedEnvelope) : [],
    evidence: asArray(plan?.evidence),
    generatedAt: plan?.generatedAt || plan?.createdAt || '',
    updatedAt: plan?.updatedAt || plan?.generatedAt || plan?.createdAt || '',
  };
};

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
