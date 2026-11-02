export function withCurriculumWelcome(messages, {
  courseId,
  curriculumWelcome,
  isMessagesLoading = false,
} = {}) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const answer = String(curriculumWelcome || '').trim();

  if (!answer || isMessagesLoading) return safeMessages;

  const curriculumId = `curriculum-${courseId}`;
  const conversationMessages = safeMessages.filter((message) => message?.id !== curriculumId);

  return [{
    id: curriculumId,
    question: '',
    answer,
    proactive: true,
    mode: 'RAG',
  }, ...conversationMessages];
}
