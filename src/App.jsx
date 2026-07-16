import { Outlet } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import AuthedLayout from './app/layouts/AuthedLayout';
import { useAppNavigation } from './app/useAppNavigation';
import LoginPage from './features/auth/LoginPage';
import Toast from './components/Toast';
import { useAuthSession } from './features/auth/hooks/useAuthSession';
import { useToastMessage } from './hooks/useToastMessage';
import { getFptTheme } from './theme/fptTheme';

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

  return (
    <ConfigProvider theme={getFptTheme(navigation.isDarkMode)}>
      {!auth.currentUser ? (
        <>
          <LoginPage onLoginSuccess={handleLoginSuccess} triggerToast={toast.triggerToast} />
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
          <Outlet context={{
            activeRole: navigation.activeRole,
            currentUserRole: auth.currentUserRole,
            workspaceProps,
          }} />
        </AuthedLayout>
      )}
    </ConfigProvider>
  );
}

export default App;
