import { lazy, Suspense, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { useAppNavigation } from './app/useAppNavigation';
import { getHomeRouteForRole } from './app/routes';
import Toast from './components/Toast';
import { useAuthSession } from './features/auth/hooks/useAuthSession';
import { useToastMessage } from './hooks/useToastMessage';

const LoginPage = lazy(() => import('./features/auth/LoginPage'));
const ThemedAuthedLayout = lazy(() => import('./app/layouts/ThemedAuthedLayout'));
const RealtimeEventsProvider = lazy(() => import('./features/realtime/RealtimeEventsProvider'));

function RouteLoadingFallback() {
  return (
    <div className="app-route-loading" role="status" aria-live="polite">
      <span className="app-route-loading__spinner" aria-hidden="true" />
      <span>Đang tải...</span>
    </div>
  );
}

function App() {
  const auth = useAuthSession();
  const navigation = useAppNavigation({
    currentUser: auth.currentUser,
    currentUserRole: auth.currentUserRole,
  });
  const { navigate } = navigation;
  const toast = useToastMessage();
  const authIdentityRef = useRef('');
  const hasInitializedAuthIdentityRef = useRef(false);

  useEffect(() => {
    const accountRole = auth.currentUser?.originalRole || auth.currentUser?.role || '';
    const identity = auth.currentUserId && accountRole
      ? `${auth.currentUserId}:${accountRole}`
      : '';

    if (!hasInitializedAuthIdentityRef.current) {
      hasInitializedAuthIdentityRef.current = true;
      authIdentityRef.current = identity;
      return;
    }

    if (identity && identity !== authIdentityRef.current) {
      navigate(getHomeRouteForRole(accountRole), { replace: true });
    }
    authIdentityRef.current = identity;
  }, [auth.currentUser, auth.currentUserId, navigate]);

  const handleLoginSuccess = (user) => {
    const { accountRole } = auth.completeLogin(user);
    navigation.setCourseId('');
    navigation.setClassId('');
    navigate(getHomeRouteForRole(accountRole), { replace: true });
  };

  const handleLogout = () => {
    navigation.setCourseId('');
    navigation.setClassId('');
    auth.logout();
    navigate('/login', { replace: true });
  };

  const workspaceProps = {
    currentUser: auth.currentUser,
    switchTab: navigation.switchTab,
    courseId: navigation.courseId,
    setCourseId: navigation.setCourseId,
    classId: navigation.classId,
    setClassId: navigation.setClassId,
    isDarkMode: navigation.isDarkMode,
    triggerToast: toast.triggerToast,
  };

  if (!auth.currentUser) {
    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <LoginPage onLoginSuccess={handleLoginSuccess} triggerToast={toast.triggerToast} />
        {toast.toastMessage && <Toast message={toast.toastMessage} onClose={() => toast.setToastMessage(null)} />}
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <RealtimeEventsProvider
        enabled
        sessionKey={auth.currentUserId}
        onProfileUpdated={auth.updateCurrentUser}
      >
        <ThemedAuthedLayout
          activeRole={navigation.activeRole}
          activeTab={navigation.activeTab}
          switchTab={navigation.switchTab}
          isDarkMode={navigation.isDarkMode}
          setIsDarkMode={navigation.setIsDarkMode}
          currentUser={auth.currentUser}
          courseId={navigation.courseId}
          classId={navigation.classId}
          onLogout={handleLogout}
          onProfileUpdated={auth.updateCurrentUser}
          toastMessage={toast.toastMessage}
          onCloseToast={() => toast.setToastMessage(null)}
        >
          <Outlet context={{
            activeRole: navigation.activeRole,
            currentUserRole: auth.currentUserRole,
            workspaceProps,
          }} />
        </ThemedAuthedLayout>
      </RealtimeEventsProvider>
    </Suspense>
  );
}

export default App;
