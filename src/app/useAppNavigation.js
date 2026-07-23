import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { normalizeAppRole } from '../utils/formatters';
import { readJsonStorage } from '../utils/storage';
import { getHomeRouteForRole, getRouteConfig, getRouteForTab, getRouteState } from './routes';

const APP_UI_STATE_KEY = 'ai-tutor:ui-state';

export function useAppNavigation({ currentUser, currentUserRole }) {
  const location = useLocation();
  const navigate = useNavigate();
  const routeConfig = useMemo(() => getRouteConfig(location.pathname), [location.pathname]);
  const routeState = useMemo(() => getRouteState(location.pathname), [location.pathname]);
  const initialUiState = readJsonStorage(APP_UI_STATE_KEY, {});

  const [preferredRole, setPreferredRole] = useState(() => routeState?.role || initialUiState.activeRole || 'student');
  const [courseId, setCourseId] = useState(() => initialUiState.courseId || '');
  const [classId, setClassId] = useState(() => initialUiState.classId || '');
  const [isDarkMode, setIsDarkMode] = useState(() => Boolean(initialUiState.isDarkMode));
  const activeRole = routeState?.role || preferredRole;
  const activeTab = routeState?.tab || `${activeRole}-dashboard`;

  useEffect(() => {
    document.body.classList.toggle('theme-dark', isDarkMode);
    document.body.classList.toggle('theme-light', !isDarkMode);

    return () => {
      document.body.classList.remove('theme-dark', 'theme-light');
    };
  }, [isDarkMode]);

  useEffect(() => {
    window.sessionStorage.setItem(APP_UI_STATE_KEY, JSON.stringify({
      activeRole,
      activeTab,
      courseId,
      classId,
      isDarkMode,
    }));
  }, [activeRole, activeTab, courseId, classId, isDarkMode]);

  useEffect(() => {
    if (!routeState) return;
    if (currentUser && currentUserRole !== 'admin' && routeState.role !== currentUserRole) {
      if (routeConfig?.allowedAccountRoles?.length) return;
      navigate(getHomeRouteForRole(currentUserRole), { replace: true });
      return;
    }
  }, [currentUser, currentUserRole, navigate, routeConfig, routeState]);

  useEffect(() => {
    if (!currentUser) return;
    if (routeState) return;
    navigate(getHomeRouteForRole(activeRole), { replace: true });
  }, [activeRole, currentUser, navigate, routeState]);

  const switchTab = (tab) => {
    const route = getRouteForTab(tab);
    if (route && route !== location.pathname) {
      navigate(route);
    }
  };

  const handleRoleChange = (role) => {
    const normalizedRole = normalizeAppRole(role);
    if (currentUser && currentUserRole !== 'admin' && normalizedRole !== currentUserRole) {
      navigate(getHomeRouteForRole(currentUserRole), { replace: true });
      return;
    }
    setPreferredRole(normalizedRole);
    navigate(getHomeRouteForRole(normalizedRole));
  };

  return {
    activeRole,
    activeTab,
    isDarkMode,
    setIsDarkMode,
    courseId,
    setCourseId,
    classId,
    setClassId,
    switchTab,
    handleRoleChange,
    navigate,
  };
}
