import { lazy, Suspense, useState } from 'react';
import {
  LogOut,
  Moon,
  Sun,
} from 'lucide-react';
import { Switch } from 'antd';
import { getAccountRoleLabel, normalizeAccountRole } from '../constants/roles';

const ProfileModal = lazy(() => import('./common/ProfileModal'));

function Header({ activeRole, isDarkMode, setIsDarkMode, currentUser, onLogout, onProfileUpdated }) {
  const accountRole = normalizeAccountRole(currentUser?.role || activeRole);
  const roleLabel = getAccountRoleLabel(accountRole);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

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
      <div className="logo-area">
        <div className="fpt-text-mark">
          <span className="brand-fpt">FPT</span>
          <span className="brand-university">University</span>
          <small>AI Tutor</small>
        </div>
      </div>
      
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
        {currentUser && (
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
