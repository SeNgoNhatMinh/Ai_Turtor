import { useCallback, useEffect, useMemo, useState } from 'react';
import { clearAuthToken, getAuthToken } from '../services/tokenStorage';
import { getAccountRoleFromJwt, getJwtExpiresAtMs, isJwtExpired } from '../services/authResponse';
import { refreshAccessToken } from '../services/tokenRefresh';
import { normalizeAccountRole } from '../../../constants/roles';
import { normalizeAppRole } from '../../../utils/formatters';
import {
  APP_SESSION_USER_KEY,
  clearLastPath,
  readJsonStorage,
  removeJsonStorage,
  sanitizePersistedUser,
  writeJsonStorage,
} from '../../../utils/storage';

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

function buildSessionUser(user) {
  const accountRole = getUserRole(user);
  if (!accountRole) return null;
  return {
    ...user,
    originalRole: accountRole,
    role: accountRole,
    workspaceRole: normalizeAppRole(accountRole),
    authRoleVerified: true,
  };
}

function readInitialSessionState() {
  const token = getAuthToken();
  const persisted = sanitizePersistedUser(readJsonStorage(APP_SESSION_USER_KEY, null));
  if (!persisted) {
    if (token && isJwtExpired(token)) clearAuthToken();
    return { currentUser: null, isRestoring: false };
  }

  const tokenRole = getAccountRoleFromJwt(token);
  if (!tokenRole && persisted.authRoleVerified !== true) {
    return { currentUser: null, isRestoring: false };
  }
  const currentUser = buildSessionUser(persisted);
  if (!currentUser) return { currentUser: null, isRestoring: false };
  return {
    currentUser,
    isRestoring: !token || isJwtExpired(token),
  };
}

export function useAuthSession() {
  const [initialState] = useState(readInitialSessionState);
  const [currentUser, setCurrentUser] = useState(initialState.currentUser);
  const [isRestoring, setIsRestoring] = useState(initialState.isRestoring);

  const currentUserId = currentUser?.userId || currentUser?.id || '';
  const currentUserRole = useMemo(
    () =>
      normalizeAppRole(
        currentUser?.originalRole ||
          currentUser?.role ||
          currentUser?.roleKey ||
          currentUser?.authority ||
          currentUser?.userRole ||
          '',
      ),
    [currentUser],
  );

  useEffect(() => {
    if (!currentUser) {
      removeJsonStorage(APP_SESSION_USER_KEY);
      return;
    }
    writeJsonStorage(APP_SESSION_USER_KEY, sanitizePersistedUser(currentUser));
  }, [currentUser]);

  useEffect(() => {
    if (!initialState.isRestoring) return undefined;
    let cancelled = false;
    refreshAccessToken()
      .then(({ user }) => {
        if (!cancelled) {
          setCurrentUser((current) => buildSessionUser({ ...current, ...(user || {}) }));
        }
      })
      .catch(() => {
        if (cancelled) return;
        clearAuthToken();
        removeJsonStorage(APP_SESSION_USER_KEY);
        setCurrentUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialState.isRestoring]);

  const completeLogin = useCallback((user) => {
    const updatedUser = buildSessionUser(user);
    if (!updatedUser) throw createMissingRoleError();
    const accountRole = updatedUser.originalRole;
    const workspaceRole = updatedUser.workspaceRole;
    setCurrentUser(updatedUser);
    return { user: updatedUser, role: workspaceRole, accountRole };
  }, []);

  const updateCurrentUser = useCallback((profile) => {
    if (!profile || typeof profile !== 'object') return;
    setCurrentUser((current) => {
      if (!current) return current;
      return {
        ...current,
        ...profile,
        id: current.id || profile.id || profile.userId,
        userId: current.userId || profile.userId || profile.id,
        originalRole: current.originalRole,
        role: current.role,
        workspaceRole: current.workspaceRole,
        authRoleVerified: true,
      };
    });
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    removeJsonStorage(APP_SESSION_USER_KEY);
    clearLastPath();
    clearAuthToken();
  }, []);

  useEffect(() => {
    if (!currentUser || isRestoring) return undefined;
    let cancelled = false;
    let timerId;

    const scheduleRefresh = () => {
      const expiresAt = getJwtExpiresAtMs(getAuthToken());
      if (!expiresAt || cancelled) return;
      const delay = Math.max(0, Math.min(expiresAt - Date.now() - 60_000, 2_147_000_000));
      timerId = window.setTimeout(async () => {
        try {
          const { user } = await refreshAccessToken();
          if (!cancelled) {
            setCurrentUser((current) => buildSessionUser({ ...current, ...user }));
            scheduleRefresh();
          }
        } catch {
          if (cancelled) return;
          if (isJwtExpired(getAuthToken())) {
            logout();
          } else {
            timerId = window.setTimeout(scheduleRefresh, 30_000);
          }
        }
      }, delay);
    };

    scheduleRefresh();
    return () => {
      cancelled = true;
      if (timerId) window.clearTimeout(timerId);
    };
  }, [currentUser, isRestoring, logout]);

  return {
    currentUser,
    currentUserId,
    currentUserRole,
    isRestoring,
    completeLogin,
    updateCurrentUser,
    logout,
  };
}
