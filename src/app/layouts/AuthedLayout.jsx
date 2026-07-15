import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import Toast from '../../components/Toast';

export default function AuthedLayout({
  activeRole,
  activeTab,
  switchTab,
  handleRoleChange,
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
        handleRoleChange={handleRoleChange}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        currentUser={currentUser}
        onLogout={onLogout}
      />
      <div className="main-layout">
        <Sidebar activeRole={activeRole} activeTab={activeTab} switchTab={switchTab} />
        <main className="content-wrapper">
          {children}
        </main>
      </div>
      {toastMessage && <Toast message={toastMessage} onClose={onCloseToast} />}
    </div>
  );
}
