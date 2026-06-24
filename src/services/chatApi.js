import { apiService } from './api';

export const chatApi = {
  sendAiQuery: apiService.sendAiQuery,
  sendCodeMentorQuery: apiService.sendCodeMentorQuery,
  uploadCodeFileAI: apiService.uploadCodeFileAI,
  uploadCodeFileMentor: apiService.uploadCodeFileMentor,
};
