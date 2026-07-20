import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useAppNavigation } from './app/useAppNavigation';
import Toast from './components/Toast';
import { useAuthSession } from './features/auth/hooks/useAuthSession';
import { useToastMessage } from './hooks/useToastMessage';
import RealtimeEventsProvider from './features/realtime/RealtimeEventsProvider';

const LoginPage = lazy(() => import('./features/auth/LoginPage'));
const ThemedAuthedLayout = lazy(() => import('./app/layouts/ThemedAuthedLayout'));

function RouteLoadingFallback() {
  return (
    <div className="app-route-loading" role="status" aria-live="polite">
      <span className="app-route-loading__spinner" aria-hidden="true" />
      <span>Loading...</span>
    </div>
  );
}

function App() {
  const auth = useAuthSession();
  const navigation = useAppNavigation({
    currentUser: auth.currentUser,
    currentUserRole: auth.currentUserRole,
  });
  const toast = useToastMessage();

  const handleLoginSuccess = (user) => {
    const { role } = auth.completeLogin(user);
    navigation.setCourseId('');
    navigation.setClassId('');
    navigation.handleRoleChange(role);
  };

  const handleLogout = () => {
    navigation.setCourseId('');
    navigation.setClassId('');
    auth.logout();
    navigation.navigate('/login', { replace: true });
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
      <RealtimeEventsProvider enabled sessionKey={auth.currentUserId}>
        <ThemedAuthedLayout
          activeRole={navigation.activeRole}
          activeTab={navigation.activeTab}
          switchTab={navigation.switchTab}
          isDarkMode={navigation.isDarkMode}
          setIsDarkMode={navigation.setIsDarkMode}
          currentUser={auth.currentUser}
          onLogout={handleLogout}
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
