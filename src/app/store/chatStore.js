import { create } from 'zustand';

export const useChatStore = create((set, get) => ({
  sessions: [],
  messages: [],
  pinnedChatMessages: [],
  activeSessionId: null,
  activeSessionTitle: 'AI Tutor Chat',
  activeAiRequestId: 0,
  canceledAiRequestIds: new Set(),

  setSessions: (sessions) => set({ sessions }),
  setMessages: (messages) => set({ messages }),
  setPinnedChatMessages: (messages) => set({ pinnedChatMessages: messages }),
  setActiveSessionId: (id) => set({ activeSessionId: id }),
  setActiveSessionTitle: (title) => set({ activeSessionTitle: title }),
  
  incrementActiveAiRequestId: () => {
    const nextId = get().activeAiRequestId + 1;
    set({ activeAiRequestId: nextId });
    return nextId;
  },
  
  cancelAiRequest: (id) => {
    const newSet = new Set(get().canceledAiRequestIds);
    newSet.add(id);
    set({ canceledAiRequestIds: newSet });
  },

  clearCanceledAiRequests: () => {
    set({ canceledAiRequestIds: new Set() });
  }
}));
