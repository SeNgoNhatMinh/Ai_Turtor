import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import Toast from '../../components/Toast';
import './AuthedLayout.css';

export default function AuthedLayout({
  activeRole,
  activeTab,
  switchTab,
  isDarkMode,
  setIsDarkMode,
  currentUser,
  onLogout,
  toastMessage,
  onCloseToast,
  children,
}) {
  return (
    <div className={`app-container ${isDarkMode ? 'dark' : 'light'}`}>
      <Header
        activeRole={activeRole}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        currentUser={currentUser}
        onLogout={onLogout}
      />
      <div className="main-layout">
        <Sidebar
          accountRole={currentUser?.originalRole || currentUser?.role}
          activeRole={activeRole}
          activeTab={activeTab}
          switchTab={switchTab}
        />
        <main className="content-wrapper">
          {children}
        </main>
      </div>
      {toastMessage && <Toast message={toastMessage} onClose={onCloseToast} />}
    </div>
  );
}
