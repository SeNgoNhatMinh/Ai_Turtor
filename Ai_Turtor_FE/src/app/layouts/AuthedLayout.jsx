import { useCallback, useEffect, useMemo, useState } from 'react';
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
  const { isMobile, width: viewportWidth } = useResponsiveViewport();
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);
  const [profileOpenSignal, setProfileOpenSignal] = useState(0);
  const navigationItems = useMemo(
    () => getNavigationForRole(currentUser?.originalRole || currentUser?.role || activeRole),
    [activeRole, currentUser?.originalRole, currentUser?.role],
  );
  const activePageLabel = navigationItems.find((item) => item.key === activeTab)?.label || 'AI Tutor';
  const openMobileNavigation = useCallback(() => setIsMobileNavigationOpen(true), []);
  const closeMobileNavigation = useCallback(() => setIsMobileNavigationOpen(false), []);
  const navigateHome = useCallback(() => {
    const firstNavigationKey = navigationItems[0]?.key;
    if (firstNavigationKey) switchTab?.(firstNavigationKey);
  }, [navigationItems, switchTab]);
  const openProfileFromNavigation = useCallback(() => {
    setIsMobileNavigationOpen(false);
    setProfileOpenSignal((signal) => signal + 1);
  }, []);

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
      <a className="skip-link" href="#main-content">Chuyển đến nội dung chính</a>
      <Header
        activeRole={activeRole}
        activePageLabel={activePageLabel}
        isMobile={isMobile}
        onOpenNavigation={openMobileNavigation}
        onNavigateHome={navigateHome}
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
            compactByDefault={viewportWidth < 1024}
          />
        )}
        <main id="main-content" className="content-wrapper" tabIndex="-1">
          {children}
        </main>
      </div>
      {isMobile && (
        <MobileNavigationDrawer
          open={isMobileNavigationOpen}
          onClose={closeMobileNavigation}
          accountRole={currentUser?.originalRole || currentUser?.role}
          activeRole={activeRole}
          activeTab={activeTab}
          switchTab={switchTab}
          currentUser={currentUser}
          courseId={courseId}
          classId={classId}
          onLogout={onLogout}
          onOpenProfile={openProfileFromNavigation}
        />
      )}
      {toastMessage && <Toast message={toastMessage} onClose={onCloseToast} />}
    </div>
  );
}
