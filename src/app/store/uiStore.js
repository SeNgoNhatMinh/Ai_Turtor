import { create } from 'zustand';
import { readJsonStorage, writeJsonStorage } from '../../utils/storage';

const APP_UI_STATE_KEY = 'ai-tutor:ui-state';

const initialUiState = readJsonStorage(APP_UI_STATE_KEY, {});

export const useUiStore = create((set, get) => ({
  activeTab: initialUiState.activeTab || 'student-chat',
  courseId: initialUiState.courseId || 'PRJ301',
  classId: initialUiState.classId || 'SE1840',
  isDarkMode: Boolean(initialUiState.isDarkMode),
  toastMessage: null,

  setActiveTab: (tab) => {
    set({ activeTab: tab });
    get().persist();
  },

  setCourseId: (id) => {
    set({ courseId: id });
    get().persist();
  },

  setClassId: (id) => {
    set({ classId: id });
    get().persist();
  },

  setIsDarkMode: (isDark) => {
    set({ isDarkMode: isDark });
    get().persist();
  },

  setToastMessage: (msg) => set({ toastMessage: msg }),

  persist: () => {
    const { activeTab, courseId, classId, isDarkMode } = get();
    // Use the authStore state to persist activeRole along with UI state
    // but since we separated it, let's just persist the UI parts, and let authStore handle role if needed,
    // actually initialUiState contained activeRole. Let's rely on authStore for activeRole, but read it here for persistence if needed.
    // For simplicity, we just persist what UI store manages.
    const currentStorage = readJsonStorage(APP_UI_STATE_KEY, {});
    writeJsonStorage(APP_UI_STATE_KEY, {
      ...currentStorage,
      activeTab,
      courseId,
      classId,
      isDarkMode,
    });
  }
}));
