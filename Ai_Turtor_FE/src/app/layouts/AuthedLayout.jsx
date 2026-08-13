import { useEffect } from 'react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import Toast from '../../components/Toast';
import { closeActiveConfirm } from '../../components/common/confirmDialog';
import './AuthedLayout.css';

export default function AuthedLayout({
  activeRole,
  activeTab,
  switchTab,
  isDarkMode,
  setIsDarkMode,
  currentUser,
  courseId,
  classId,
  onLogout,
  onProfileUpdated,
  toastMessage,
  onCloseToast,
  children,
}) {
  const isFocusedStudentChat = activeRole === 'student' && activeTab === 'student-chat';

  useEffect(() => {
    // A confirm portal must never survive a page/tab change and cover the app.
    closeActiveConfirm();
    return closeActiveConfirm;
  }, [activeTab]);

  return (
    <div className={`app-container role-${activeRole} ${isDarkMode ? 'dark' : 'light'} ${isFocusedStudentChat ? 'app-container--focused-chat' : ''}`}>
      <Header
        activeRole={activeRole}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        currentUser={currentUser}
        onLogout={onLogout}
        onProfileUpdated={onProfileUpdated}
      />
      <div className="main-layout">
        <Sidebar
          accountRole={currentUser?.originalRole || currentUser?.role}
          activeRole={activeRole}
          activeTab={activeTab}
          switchTab={switchTab}
          courseId={courseId}
          classId={classId}
        />
        <main className="content-wrapper">
          {children}
        </main>
      </div>
      {toastMessage && <Toast message={toastMessage} onClose={onCloseToast} />}
    </div>
  );
}
