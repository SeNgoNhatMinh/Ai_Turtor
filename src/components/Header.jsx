import { lazy, Suspense, useMemo, useState } from 'react';
import {
  CloudRain,
  Droplet,
  Flower2,
  Leaf,
  LogOut,
  Moon,
  Sprout,
  Sun,
  SunMedium,
  Wind,
} from 'lucide-react';
import { Switch } from 'antd';
import { getAccountRoleLabel, normalizeAccountRole } from '../constants/roles';

const ProfileModal = lazy(() => import('./common/ProfileModal'));

const buildSeasonItems = (items) => Array.from({ length: 12 }, (_, index) => items[index % items.length]);

const getSeasonalHeaderEffect = () => {
  const month = new Date().getMonth() + 1;

  if (month >= 1 && month <= 3) {
    return {
      key: 'spring',
      label: 'Hoa mai, hoa đào bay',
      items: buildSeasonItems([Flower2, Sprout]),
    };
  }

  if (month >= 4 && month <= 6) {
    return {
      key: 'summer',
      label: 'Nắng hè, lá xanh',
      items: buildSeasonItems([SunMedium, Leaf]),
    };
  }

  if (month >= 7 && month <= 10) {
    return {
      key: 'rain',
      label: 'Mưa rơi',
      items: buildSeasonItems([CloudRain, Droplet]),
    };
  }

  return {
    key: 'autumn',
    label: 'Lá vàng, gió nhẹ',
    items: buildSeasonItems([Leaf, Wind]),
  };
};

function Header({ activeRole, isDarkMode, setIsDarkMode, currentUser, onLogout }) {
  const seasonalEffect = useMemo(() => getSeasonalHeaderEffect(), []);
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
      <div className={`seasonal-header-effect seasonal-header-effect--${seasonalEffect.key}`} aria-hidden="true">
        {seasonalEffect.items.map((SeasonIcon, index) => (
          <span key={`${seasonalEffect.key}-${index}`} style={{ '--season-item-index': index }}>
            <SeasonIcon size={12} strokeWidth={2.2} />
          </span>
        ))}
      </div>
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

      <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Switch 
          aria-label={isDarkMode ? 'Dùng giao diện sáng' : 'Dùng giao diện tối'}
          checkedChildren={<Moon size={14} style={{ marginTop: '4px' }} />}
          unCheckedChildren={<Sun size={14} style={{ marginTop: '2px' }} />}
          checked={isDarkMode}
          onChange={(checked) => setIsDarkMode(checked)}
          style={{ background: isDarkMode ? '#000000' : '#202123' }}
        />
        <button
          type="button"
          className="user-profile-info" 
          onClick={() => currentUser && setIsProfileModalOpen(true)}
          disabled={!currentUser}
          aria-label={currentUser ? 'Mở hồ sơ và cài đặt bảo mật' : undefined}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: currentUser ? 'pointer' : 'default', border: 0, background: 'transparent', color: 'inherit' }}
        >
          <span id="current-user-name" style={{ borderBottom: currentUser ? '1px dashed currentColor' : 'none' }}>{getProfileName()}</span>
          <div className="avatar-circle">{getAvatarText()}</div>
        </button>
        {currentUser && (
          <button type="button" onClick={onLogout} style={{ background: 'transparent', border: 'none', color: isDarkMode ? '#F9FAFB' : '#202123', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
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
          />
        </Suspense>
      )}
    </header>
  );
}

export default Header;
