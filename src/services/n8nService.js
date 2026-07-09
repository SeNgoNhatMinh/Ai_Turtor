import { postN8n } from './n8nClient';

export const n8nService = {
  async sendStudentChat(payload) {
    return await postN8n('/student-chat', payload);
  },

  async submitAnswerReview(payload) {
    return await postN8n('/answer-review', payload);
  },

  async submitTeacherAnswer(payload) {
    return await postN8n('/teacher-answer-escalation', payload);
  },

  async submitSeniorApproval(payload) {
    return await postN8n('/senior-knowledge-approval', payload);
  }
};
