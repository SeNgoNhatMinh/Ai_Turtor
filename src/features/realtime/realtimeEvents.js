const WS_PROTOCOL = {
  'http:': 'ws:',
  'https:': 'wss:',
};

export const REALTIME_EVENT_TYPES = Object.freeze({
  material: ['MATERIAL_INDEXING', 'MATERIAL_INDEXED', 'MATERIAL_INDEXING_FAILED'],
  studentAssignment: ['ASSIGNMENT_ASSIGNED', 'ASSIGNMENT_REVIEWED'],
  teacherAssignment: ['ASSIGNMENT_SUBMITTED'],
  assignmentAiGrading: ['AI_GRADING', 'AI_GRADING_COMPLETED', 'AI_GRADING_FAILED'],
  expertTasks: ['EXPERT_TASK_CREATED', 'EXPERT_TASK_ASSIGNED'],
  expertContributions: [
    'GOLD_QA_SUBMITTED',
    'GOLD_QA_APPROVED',
    'GOLD_QA_REJECTED',
    'RUBRIC_SUBMITTED',
    'RUBRIC_APPROVED',
    'RUBRIC_REJECTED',
  ],
  expertEvaluation: ['EVAL_RUN_COMPLETED', 'EVAL_RUN_FAILED'],
  tutorV2: [
    'EXPERT_TASK_CREATED',
    'EXPERT_TASK_ASSIGNED',
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
