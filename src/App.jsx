import { lazy, Suspense } from 'react';
import { ConfigProvider } from 'antd';
import AuthedLayout from './app/layouts/AuthedLayout';
import { useAppNavigation } from './app/useAppNavigation';
import Login from './pages/Login';
import Toast from './components/Toast';
import { useAuthSession } from './features/auth/useAuthSession';
import { useToastMessage } from './hooks/useToastMessage';
import { getFptTheme } from './theme/fptTheme';
import AsyncState from './components/common/AsyncState';

const StudentWorkspace = lazy(() => import('./app/workspaces/StudentWorkspace'));
const TeacherWorkspace = lazy(() => import('./app/workspaces/TeacherWorkspace'));
const AdminWorkspace = lazy(() => import('./app/workspaces/AdminWorkspace'));

function WorkspaceFallback() {
  return <AsyncState loading loadingLabel="Loading workspace..." loadingRows={6} />;
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
    navigation.handleRoleChange(role);
  };

  const handleLogout = () => {
    auth.logout();
    navigation.navigate('/login', { replace: true });
  };

  const sharedWorkspaceProps = {
    currentUser: auth.currentUser,
    activeTab: navigation.activeTab,
    switchTab: navigation.switchTab,
    courseId: navigation.courseId,
    setCourseId: navigation.setCourseId,
    classId: navigation.classId,
    setClassId: navigation.setClassId,
    isDarkMode: navigation.isDarkMode,
    triggerToast: toast.triggerToast,
  };

  return (
    <ConfigProvider theme={getFptTheme(navigation.isDarkMode)}>
      {!auth.currentUser ? (
        <>
          <Login onLoginSuccess={handleLoginSuccess} triggerToast={toast.triggerToast} />
          {toast.toastMessage && <Toast message={toast.toastMessage} onClose={() => toast.setToastMessage(null)} />}
        </>
      ) : (
        <AuthedLayout
          activeRole={navigation.activeRole}
          activeTab={navigation.activeTab}
          switchTab={navigation.switchTab}
          handleRoleChange={navigation.handleRoleChange}
          isDarkMode={navigation.isDarkMode}
          setIsDarkMode={navigation.setIsDarkMode}
          currentUser={auth.currentUser}
          onLogout={handleLogout}
          toastMessage={toast.toastMessage}
          onCloseToast={() => toast.setToastMessage(null)}
        >
          <Suspense fallback={<WorkspaceFallback />}>
            {navigation.activeRole === 'student' && <StudentWorkspace {...sharedWorkspaceProps} />}
            {navigation.activeRole === 'teacher' && <TeacherWorkspace {...sharedWorkspaceProps} />}
            {navigation.activeRole === 'admin' && <AdminWorkspace {...sharedWorkspaceProps} />}
          </Suspense>
        </AuthedLayout>
      )}
    </ConfigProvider>
  );
}

export default App;
