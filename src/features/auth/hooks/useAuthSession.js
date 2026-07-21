import { useCallback, useEffect, useMemo, useState } from 'react';
import { clearAuthToken, getAuthToken } from '../services/tokenStorage';
import { getAccountRoleFromJwt } from '../services/authResponse';
import { normalizeAccountRole } from '../../../constants/roles';
import { normalizeAppRole } from '../../../utils/formatters';
import { readJsonStorage, sanitizePersistedUser } from '../../../utils/storage';

const APP_SESSION_USER_KEY = 'ai-tutor:current-user';

function getUserRole(user) {
  const tokenRole = getAccountRoleFromJwt(getAuthToken());
  const responseRole = normalizeAccountRole(
    user?.originalRole || user?.role || user?.roleKey || user?.authority || user?.userRole,
    '',
  );
  return tokenRole || responseRole;
}

function createMissingRoleError() {
  const error = new Error('Authenticated user role is missing or unsupported.');
  error.userMessage = 'Không thể xác định vai trò tài khoản. Vui lòng đăng nhập lại.';
  return error;
}

export function useAuthSession() {
  const [currentUser, setCurrentUser] = useState(() => {
    const persisted = sanitizePersistedUser(readJsonStorage(APP_SESSION_USER_KEY, null));
    if (!persisted) return null;
    const tokenRole = getAccountRoleFromJwt(getAuthToken());
    if (!tokenRole && persisted.authRoleVerified !== true) return null;
    const accountRole = getUserRole(persisted);
    if (!accountRole) return null;
    return {
      ...persisted,
      originalRole: accountRole,
      role: accountRole,
      workspaceRole: normalizeAppRole(accountRole),
      authRoleVerified: true,
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
    const accountRole = getUserRole(user);
    if (!accountRole) throw createMissingRoleError();
    const workspaceRole = normalizeAppRole(accountRole);
    const updatedUser = {
      ...user,
      originalRole: accountRole,
      role: accountRole,
      workspaceRole,
      authRoleVerified: true,
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
