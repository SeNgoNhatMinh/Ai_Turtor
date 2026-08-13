export const normalizeSupportStatus = (status) => String(status || '').toUpperCase();

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
  const status = normalizeSupportStatus(ticket?.status);
  return Boolean(getMentorAnswer(ticket))
    || status.includes('ANSWERED')
    || status.includes('COMPLETED')
    || status.includes('CLOSED');
};
