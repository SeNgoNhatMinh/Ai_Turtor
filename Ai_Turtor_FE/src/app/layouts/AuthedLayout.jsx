import { useEffect, useMemo, useState } from 'react';
import Header from '../../components/Header';
import MobileNavigationDrawer from '../../components/MobileNavigationDrawer';
import Sidebar from '../../components/Sidebar';
import Toast from '../../components/Toast';
import { closeActiveConfirm } from '../../components/common/confirmDialog';
import { getNavigationForRole } from '../../config/navigation';
import useResponsiveViewport from '../../hooks/useResponsiveViewport';
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
  const { isMobile } = useResponsiveViewport();
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);
  const [profileOpenSignal, setProfileOpenSignal] = useState(0);
  const navigationItems = useMemo(
    () => getNavigationForRole(currentUser?.originalRole || currentUser?.role || activeRole),
    [activeRole, currentUser?.originalRole, currentUser?.role],
  );
  const activePageLabel = navigationItems.find((item) => item.key === activeTab)?.label || 'AI Tutor';

  useEffect(() => {
    // A confirm portal must never survive a page/tab change and cover the app.
    closeActiveConfirm();
    return closeActiveConfirm;
  }, [activeTab]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsMobileNavigationOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, isMobile]);

  return (
    <div className={`app-container role-${activeRole} ${isDarkMode ? 'dark' : 'light'} ${isMobile ? 'app-container--mobile' : ''} ${isFocusedStudentChat ? 'app-container--focused-chat' : ''}`}>
      <Header
        activeRole={activeRole}
        activePageLabel={activePageLabel}
        isMobile={isMobile}
        onOpenNavigation={() => setIsMobileNavigationOpen(true)}
        onNavigateHome={() => {
          const firstNavigationKey = navigationItems[0]?.key;
          if (firstNavigationKey) switchTab?.(firstNavigationKey);
        }}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        currentUser={currentUser}
        onLogout={onLogout}
        onProfileUpdated={onProfileUpdated}
        profileOpenSignal={profileOpenSignal}
      />
      <div className="main-layout">
        {!isMobile && (
          <Sidebar
            accountRole={currentUser?.originalRole || currentUser?.role}
            activeRole={activeRole}
            activeTab={activeTab}
            switchTab={switchTab}
            courseId={courseId}
            classId={classId}
          />
        )}
        <main className="content-wrapper">
          {children}
        </main>
      </div>
      {isMobile && (
        <MobileNavigationDrawer
          open={isMobileNavigationOpen}
          onClose={() => setIsMobileNavigationOpen(false)}
          accountRole={currentUser?.originalRole || currentUser?.role}
          activeRole={activeRole}
          activeTab={activeTab}
          switchTab={switchTab}
          currentUser={currentUser}
          courseId={courseId}
          classId={classId}
          onLogout={onLogout}
          onOpenProfile={() => {
            setIsMobileNavigationOpen(false);
            setProfileOpenSignal((signal) => signal + 1);
          }}
        />
      )}
      {toastMessage && <Toast message={toastMessage} onClose={onCloseToast} />}
    </div>
  );
}
