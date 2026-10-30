const WS_PROTOCOL = {
  'http:': 'ws:',
  'https:': 'wss:',
};

export const REALTIME_EVENT_TYPES = Object.freeze({
  tutorSession: ['TUTOR_SESSION_OPENED', 'TUTOR_SESSION_UPDATED'],
  pedagogicalDirective: [
    'PEDAGOGICAL_DIRECTIVE_CONFIRMED',
    'PEDAGOGICAL_DIRECTIVE_ARCHIVED',
    // Keep compatibility with early backend event names.
    'TUTOR_DIRECTIVE_CONFIRMED',
    'TUTOR_DIRECTIVE_ARCHIVED',
    'DIRECTIVE_CONFIRMED',
    'DIRECTIVE_ARCHIVED',
  ],
  material: ['MATERIAL_INDEXING', 'MATERIAL_INDEXED', 'MATERIAL_INDEXING_FAILED', 'MATERIAL_IMPORT_PROGRESS'],
  studentAssignment: ['ASSIGNMENT_ASSIGNED', 'ASSIGNMENT_REVIEWED'],
  teacherAssignment: ['ASSIGNMENT_SUBMITTED'],
  assignmentAiGrading: ['AI_GRADING', 'AI_GRADING_COMPLETED', 'AI_GRADING_FAILED'],
  expertTasks: ['EXPERT_TASK_CREATED', 'EXPERT_TASK_ASSIGNED', 'EXPERT_TASK_UPDATED', 'EXPERT_TASK_DELETED'],
  expertContributions: [
    'GOLD_QA_EXAMINED',
    'GOLD_QA_SUBMITTED',
    'GOLD_QA_APPROVED',
    'GOLD_QA_REJECTED',
    'RUBRIC_SUBMITTED',
    'RUBRIC_APPROVED',
    'RUBRIC_REJECTED',
  ],
  expertEvaluation: ['EVAL_RUN_COMPLETED', 'EVAL_RUN_FAILED'],
  answerReview: ['ANSWER_REVIEW_NEEDS_MENTOR', 'ANSWER_REVIEW_NEEDS_SENIOR'],
  supportEscalation: [
    'SUPPORT_ESCALATION_CREATED',
    'SUPPORT_ESCALATION_UPDATED',
    'SUPPORT_ESCALATION_ANSWERED',
  ],
  knowledgeCandidate: [
    'KNOWLEDGE_CANDIDATE_CREATED',
    'KNOWLEDGE_CANDIDATE_UPDATED',
    'KNOWLEDGE_CANDIDATE_INDEXED',
    'KNOWLEDGE_CANDIDATE_REJECTED',
    'KNOWLEDGE_CANDIDATE_UNINDEXED',
    'KNOWLEDGE_CANDIDATE_DELETED',
  ],
  studentQuestion: ['STUDENT_QUESTION_ANSWERED'],
  aiRequestLog: ['AI_REQUEST_LOGGED'],
  supportLevel: ['SUPPORT_LEVEL_CHANGED'],
  teacherPresence: ['TEACHER_PRESENCE_CHANGED'],
  academicEntity: [
    'COURSE_CREATED', 'COURSE_UPDATED', 'COURSE_DELETED',
    'CLASS_SECTION_CREATED', 'CLASS_SECTION_UPDATED', 'CLASS_SECTION_DELETED',
    'SEMESTER_CREATED', 'SEMESTER_UPDATED', 'SEMESTER_DELETED',
    'ENROLLMENT_CREATED', 'ENROLLMENT_UPDATED', 'ENROLLMENT_DELETED',
  ],
  adminUser: ['USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'USER_ROLE_CHANGED'],
  quizAssignment: ['QUIZ_ASSIGNMENT_CREATED', 'QUIZ_ASSIGNMENT_PUBLISHED', 'QUIZ_ASSIGNMENT_DELETED'],
  assignmentCrud: [
    'ASSIGNMENT_CREATED', 'ASSIGNMENT_UPDATED', 'ASSIGNMENT_DELETED',
    'ASSIGNMENT_SUBMITTED', 'ASSIGNMENT_REVIEWED',
  ],
  studentLearning: ['LEARNING_PROGRESS_UPDATED', 'STUDENT_QUESTION_ANSWERED'],
  chatSession: ['CHAT_SESSION_CREATED', 'CHAT_SESSION_UPDATED', 'CHAT_SESSION_DELETED'],
  quizHistory: ['QUIZ_SUBMITTED', 'QUIZ_REVIEWED', 'QUIZ_ASSIGNMENT_PUBLISHED'],
  tutorV2: [
    'EXPERT_TASK_CREATED',
    'EXPERT_TASK_ASSIGNED',
    'EXPERT_TASK_UPDATED',
    'EXPERT_TASK_DELETED',
    'GOLD_QA_EXAMINED',
    'GOLD_QA_SUBMITTED',
    'GOLD_QA_APPROVED',
    'GOLD_QA_REJECTED',
    'RUBRIC_SUBMITTED',
    'RUBRIC_APPROVED',
    'RUBRIC_REJECTED',
    'EVAL_RUN_COMPLETED',
    'EVAL_RUN_FAILED',
  ],
});

export function getRealtimeEventDedupeKey(event) {
  if (!event?.type || !event?.entityId) return '';
  return [event.type, event.entityType, event.entityId, event.status].join('|');
}

export function buildRealtimeSocketUrl({ apiBaseUrl, explicitUrl, token, origin }) {
  const baseOrigin = origin || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  const source = explicitUrl || apiBaseUrl || '/api';
  const url = new URL(source, baseOrigin);

  url.protocol = WS_PROTOCOL[url.protocol] || url.protocol;
  if (!explicitUrl) {
    const apiPath = url.pathname.replace(/\/+$/, '').replace(/\/api$/, '');
    url.pathname = `${apiPath}/ws/events`.replace(/\/{2,}/g, '/');
  }
  url.search = '';
  if (token) url.searchParams.set('token', token);
  return url.toString();
}

export function normalizeRealtimeEvent(value) {
  let event = value;
  if (typeof value === 'string') {
    try {
      event = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!event || typeof event !== 'object' || !event.type) return null;
  return {
    ...event,
    type: String(event.type).toUpperCase(),
    entityType: String(event.entityType || '').toUpperCase(),
    entityId: event.entityId || event.id || '',
    status: String(event.status || '').toUpperCase(),
    data: event.data && typeof event.data === 'object' ? event.data : {},
  };
}

export function eventMatchesCourse(event, courseId) {
  const eventCourseId = String(event?.data?.courseId || '').trim();
  return !courseId || !eventCourseId || eventCourseId.toUpperCase() === String(courseId).trim().toUpperCase();
}

function normalizedId(value) {
  return String(value || '').trim().toUpperCase();
}

export function eventTargetsTutorStudent(event, { studentId, courseId, classId } = {}) {
  const data = event?.data || {};
  const resource = data.session || data.directive || data.tutorSession || data.pedagogicalDirective || data;
  const eventStudentId = normalizedId(resource.studentId || data.studentId);
  const eventCourseId = normalizedId(resource.courseId || data.courseId);
  const eventClassId = normalizedId(resource.classId || data.classId);
  const currentStudentId = normalizedId(studentId);
  const currentCourseId = normalizedId(courseId);
  const currentClassId = normalizedId(classId);

  if (eventStudentId && currentStudentId && eventStudentId !== currentStudentId) return false;
  if (eventCourseId && currentCourseId && eventCourseId !== currentCourseId) return false;
  if (eventClassId && currentClassId && eventClassId !== currentClassId) return false;
  return true;
}
