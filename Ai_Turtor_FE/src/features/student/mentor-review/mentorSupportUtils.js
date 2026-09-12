export const normalizeSupportStatus = (status) => String(status || '').toUpperCase();

const ANSWERED_STATUSES = new Set([
  'ANSWERED',
  'ANSWERED_PENDING_SENIOR_REVIEW',
  'ANSWERED_NO_KNOWLEDGE_CANDIDATE',
  'ANSWERED_KNOWLEDGE_REJECTED',
  'MENTOR_ANSWERED',
  'MENTOR_ANSWERED_PENDING_SENIOR_REVIEW',
  'RESOLVED',
  'RESOLVED_INDEXED',
  'AI_BRAIN_UPDATED',
  'COMPLETED',
  'CLOSED',
]);

const PROCESSING_STATUSES = new Set([
  '',
  'PENDING',
  'PENDING_OFFER',
  'WAITING_FOR_MENTOR',
  'OFFERED',
  'MENTOR_SELECTED',
  'ASSIGNED',
  'IN_CHAT',
  'CHAT_ACTIVE',
]);

export const getSupportTicketStatus = (ticket) => {
  const workflowStatus = normalizeSupportStatus(ticket?.status);
  if (ANSWERED_STATUSES.has(workflowStatus) || workflowStatus.includes('ANSWERED')) {
    return workflowStatus;
  }
  return normalizeSupportStatus(ticket?.studentVisibleStatus) || workflowStatus;
};

export const getMentorAnswer = (ticket) => (
  ticket?.mentorAnswer
  || ticket?.answer
  || ticket?.teacherAnswer
  || ticket?.response
  || ticket?.mentorResponse
  || ''
);

export const getAssignedMentor = (ticket) => (
  ticket?.assignedMentorName
  || ticket?.mentorName
  || ticket?.teacherName
  || ''
);

export const getQuestionText = (ticket) => (
  ticket?.originalQuestion
  || ticket?.question
  || ticket?.questionPreview
  || ticket?.title
  || 'Không có nội dung câu hỏi.'
);

export const getAiSnapshot = (ticket) => (
  ticket?.aiResponse
  || ticket?.aiAnswer
  || ticket?.answerSnapshot
  || ticket?.aiSnapshot
  || ''
);

export const formatSupportDateTime = (value) => {
  if (!value) return 'Chưa có thời gian';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa có thời gian';
  return date.toLocaleString('vi-VN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const isAnsweredTicket = (ticket) => {
  const status = getSupportTicketStatus(ticket);
  return Boolean(getMentorAnswer(ticket))
    || ANSWERED_STATUSES.has(status)
    || status.includes('ANSWERED');
};

export const isProcessingTicket = (ticket) => {
  if (isAnsweredTicket(ticket)) return false;
  return PROCESSING_STATUSES.has(getSupportTicketStatus(ticket));
};
