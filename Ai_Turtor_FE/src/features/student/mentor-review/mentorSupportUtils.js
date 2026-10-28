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

const REMEDIATION_PREFIX = /^Ôn lại sau câu /;
const SHORT_TITLE_LENGTH = 160;

const shorten = (text, max = SHORT_TITLE_LENGTH) => (
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
);

/**
 * Splits the raw question of a support ticket into what the student should
 * see. Quiz re-teach tickets carry the tutor's internal remediation prompt;
 * only the quiz items (question, chosen and correct answer) are shown, never
 * the instructions written for the AI.
 */
export const describeSupportQuestion = (ticket) => {
  const raw = String(getQuestionText(ticket) || '').trim();
  if (!REMEDIATION_PREFIX.test(raw)) {
    const firstLine = raw.split(/\r?\n/).find((line) => line.trim()) || raw;
    const title = shorten(firstLine.trim());
    return { title, body: title === raw ? '' : raw, quizItems: [] };
  }

  const quizItems = [];
  let current = null;
  let inOptions = false;
  for (const line of raw.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
    const start = line.match(/^(?:Câu vừa làm|Câu \d+):\s*(.*)$/);
    if (start) {
      current = { question: start[1], options: [], chosen: '', correct: '', reason: '' };
      quizItems.push(current);
      inOptions = false;
      continue;
    }
    if (!current) continue;
    if (/^Các lựa chọn:?$/.test(line)) {
      inOptions = true;
      continue;
    }
    const field = line.match(/^(Em đã chọn|Đáp án đúng|Lý do trong bài):\s*(.*)$/);
    if (field) {
      inOptions = false;
      const key = { 'Em đã chọn': 'chosen', 'Đáp án đúng': 'correct', 'Lý do trong bài': 'reason' }[field[1]];
      current[key] = field[2];
      continue;
    }
    if (inOptions && /^[A-F][.)]\s/.test(line)) current.options.push(line);
  }

  const title = quizItems.length > 1
    ? `Ôn lại ${quizItems.length} câu kiểm tra làm sai`
    : `Ôn lại câu kiểm tra: ${shorten(quizItems[0]?.question || 'câu làm sai', 120)}`;
  return { title, body: '', quizItems };
};
