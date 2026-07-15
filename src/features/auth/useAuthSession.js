import { useCallback, useEffect, useMemo, useState } from 'react';
import { clearAuthToken } from './tokenStorage';
import { readJsonStorage, sanitizePersistedUser } from '../../utils/storage';
import { normalizeAppRole } from '../../utils/formatters';
import { normalizeAccountRole } from '../../constants/roles';

const APP_SESSION_USER_KEY = 'ai-tutor:current-user';

export function useAuthSession() {
  const [currentUser, setCurrentUser] = useState(() => {
    const persisted = sanitizePersistedUser(readJsonStorage(APP_SESSION_USER_KEY, null));
    if (!persisted) return null;
    const accountRole = normalizeAccountRole(
      persisted.originalRole || persisted.role || persisted.roleKey || persisted.authority || persisted.userRole,
    );
    return {
      ...persisted,
      originalRole: accountRole,
      role: accountRole,
      workspaceRole: normalizeAppRole(accountRole),
    };
  });

  const currentUserId = currentUser?.userId || currentUser?.id || '';
  const currentUserRole = useMemo(() => normalizeAppRole(
    currentUser?.originalRole
      || currentUser?.role
      || currentUser?.roleKey
      || currentUser?.authority
      || currentUser?.userRole
      || '',
  ), [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      window.sessionStorage.removeItem(APP_SESSION_USER_KEY);
      return;
    }
    window.sessionStorage.setItem(APP_SESSION_USER_KEY, JSON.stringify(sanitizePersistedUser(currentUser)));
  }, [currentUser]);

  const completeLogin = useCallback((user) => {
    const rawRole = user?.originalRole || user?.role || user?.roleKey || user?.authority || user?.userRole || '';
    const accountRole = normalizeAccountRole(rawRole);
    const workspaceRole = normalizeAppRole(accountRole);
    const updatedUser = {
      ...user,
      originalRole: accountRole,
      role: accountRole,
      workspaceRole,
    };
    setCurrentUser(updatedUser);
    return { user: updatedUser, role: workspaceRole, accountRole };
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    window.sessionStorage.removeItem(APP_SESSION_USER_KEY);
    clearAuthToken();
  }, []);

  return {
    currentUser,
    currentUserId,
    currentUserRole,
    completeLogin,
    logout,
  };
}
