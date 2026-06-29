import { apiService } from './api';

export const conversationApi = {
  getConversations: apiService.getConversations,
  searchConversations: apiService.searchConversations,
  createConversation: apiService.createConversation,
  getMessages: apiService.getMessages,
  deleteConversation: apiService.deleteConversation,
  renameConversation: apiService.renameConversation,
  pinChatMessage: apiService.pinChatMessage,
  unpinChatMessage: apiService.unpinChatMessage,
  getPinnedMessages: apiService.getPinnedMessages,
};
