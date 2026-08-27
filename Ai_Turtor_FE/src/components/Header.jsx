import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  LogOut,
  Menu,
  Moon,
  Sun,
} from 'lucide-react';
import { Switch } from 'antd';
import { getAccountRoleLabel, normalizeAccountRole } from '../constants/roles';
import FptBrand from './common/FptBrand';

const ProfileModal = lazy(() => import('./common/ProfileModal'));

function Header({
  activeRole,
  activePageLabel,
  isMobile = false,
  onOpenNavigation,
  onNavigateHome,
  isDarkMode,
  setIsDarkMode,
  currentUser,
  onLogout,
  onProfileUpdated,
  profileOpenSignal = 0,
}) {
  const accountRole = normalizeAccountRole(currentUser?.role || activeRole);
  const roleLabel = getAccountRoleLabel(accountRole);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // The mobile navigation drawer can request the same profile modal without
  // introducing a second profile implementation.
  const lastProfileOpenSignal = useRef(profileOpenSignal);

  useEffect(() => {
    if (profileOpenSignal !== lastProfileOpenSignal.current) {
      lastProfileOpenSignal.current = profileOpenSignal;
      setIsProfileModalOpen(true);
    }
  }, [profileOpenSignal]);

  const getProfileName = () => {
    if (currentUser?.fullName) return `${roleLabel}: ${currentUser.fullName}`;
    return roleLabel;
  };

  const getAvatarText = () => {
    if (currentUser?.fullName) return currentUser.fullName.substring(0, 2).toUpperCase();
    return roleLabel.substring(0, 2).toUpperCase();
  };

  return (
    <header className="top-nav">
      {isMobile && (
        <button
          type="button"
          className="mobile-navigation-trigger"
          onClick={onOpenNavigation}
          aria-label="Mở menu điều hướng"
          aria-haspopup="dialog"
        >
          <Menu size={22} aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        className="logo-area"
        onClick={onNavigateHome}
        aria-label="Về trang đầu của thanh điều hướng"
        title="Về trang đầu"
      >
        <FptBrand compact={isMobile} />
        {isMobile && <strong className="mobile-page-title">{activePageLabel}</strong>}
      </button>
      
      <div className="role-switcher-container" aria-label="Không gian làm việc hiện tại">
        <span className="role-label">Không gian: {roleLabel}</span>
      </div>

      <div className="user-profile">
        <Switch 
          aria-label={isDarkMode ? 'Dùng giao diện sáng' : 'Dùng giao diện tối'}
          checkedChildren={<Moon size={14} style={{ marginTop: '4px' }} />}
          unCheckedChildren={<Sun size={14} style={{ marginTop: '2px' }} />}
          checked={isDarkMode}
          onChange={(checked) => setIsDarkMode(checked)}
          className="theme-mode-switch"
        />
        <button
          type="button"
          className="user-profile-info"
          onClick={() => currentUser && setIsProfileModalOpen(true)}
          disabled={!currentUser}
          aria-label={currentUser ? 'Mở hồ sơ và cài đặt bảo mật' : undefined}
        >
          <span id="current-user-name">{getProfileName()}</span>
          <div className="avatar-circle">{getAvatarText()}</div>
        </button>
        {currentUser && !isMobile && (
          <button type="button" className="header-logout-button" onClick={onLogout}>
            <LogOut size={16} /> Đăng xuất
          </button>
        )}
      </div>

      {isProfileModalOpen && (
        <Suspense fallback={null}>
          <ProfileModal
            isOpen
            onClose={() => setIsProfileModalOpen(false)}
            userId={currentUser?.id || currentUser?.userId}
            onProfileUpdated={onProfileUpdated}
          />
        </Suspense>
      )}
    </header>
  );
}

export default Header;
