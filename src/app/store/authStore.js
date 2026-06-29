import { create } from 'zustand';
import { readJsonStorage, writeJsonStorage, sanitizePersistedUser } from '../../utils/storage';

const APP_SESSION_USER_KEY = 'ai-tutor:current-user';
const APP_UI_STATE_KEY = 'ai-tutor:ui-state';

const initialUiState = readJsonStorage(APP_UI_STATE_KEY, {});

export const useAuthStore = create((set, get) => ({
  currentUser: sanitizePersistedUser(readJsonStorage(APP_SESSION_USER_KEY, null)),
  activeRole: initialUiState.activeRole || 'student',

  setCurrentUser: (user) => {
    const safeUser = sanitizePersistedUser(user);
    if (!safeUser) {
      window.sessionStorage.removeItem(APP_SESSION_USER_KEY);
    } else {
      writeJsonStorage(APP_SESSION_USER_KEY, safeUser);
    }
    set({ currentUser: safeUser });
  },

  setActiveRole: (role) => {
    set({ activeRole: role });
    const currentStorage = readJsonStorage(APP_UI_STATE_KEY, {});
    writeJsonStorage(APP_UI_STATE_KEY, { ...currentStorage, activeRole: role });
  },

  getStudentUserId: () => {
    const user = get().currentUser;
    return user?.userId || user?.id || '';
  },
  
  getCurrentUserId: () => {
    const user = get().currentUser;
    return user?.userId || user?.id || '';
  },

  getTeacherUserId: () => {
    const user = get().currentUser;
    return user?.userId || user?.id || '';
  }
}));
