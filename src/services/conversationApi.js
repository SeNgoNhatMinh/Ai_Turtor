import { apiService } from './api';

export const conversationApi = {
  getConversations: apiService.getConversations,
  createConversation: apiService.createConversation,
  getMessages: apiService.getMessages,
  deleteConversation: apiService.deleteConversation,
  renameConversation: apiService.renameConversation,
};
