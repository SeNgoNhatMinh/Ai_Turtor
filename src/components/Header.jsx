import React, { useMemo } from 'react';
import {
  CloudRain,
  Droplet,
  Flower2,
  GraduationCap,
  Leaf,
  LogOut,
  Moon,
  Presentation,
  ShieldCheck,
  Sprout,
  Sun,
  SunMedium,
  Wind,
} from 'lucide-react';
import { Switch } from 'antd';

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

function Header({ activeRole, handleRoleChange, isDarkMode, setIsDarkMode, currentUser, onLogout }) {
  const seasonalEffect = useMemo(() => getSeasonalHeaderEffect(), []);
  const userRole = String(currentUser?.role || activeRole || 'student').trim().toLowerCase();

  const getProfileName = () => {
    if (currentUser?.fullName) return `${userRole.toUpperCase()}: ${currentUser.fullName}`;
    if (activeRole === 'student') return 'Student: Student A';
    if (activeRole === 'teacher') return 'Teacher: Teacher B';
    return 'Admin: System Admin';
  };

  const getAvatarText = () => {
    if (currentUser?.fullName) return currentUser.fullName.substring(0, 2).toUpperCase();
    if (activeRole === 'student') return 'ST';
    if (activeRole === 'teacher') return 'TE';
    return 'AD';
  };

  return (
    <header className="top-nav">
      <div className={`seasonal-header-effect seasonal-header-effect--${seasonalEffect.key}`} aria-label={seasonalEffect.label}>
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
      
      <div className="role-switcher-container">
        {(!currentUser || userRole === 'admin') ? (
          <>
            <span className="role-label">Select role:</span>
            <div className="role-buttons">
              <button 
                className={`role-btn ${activeRole === 'student' ? 'active' : ''}`} 
                onClick={() => handleRoleChange('student')}
              >
                <GraduationCap /> Student
              </button>
              <button 
                className={`role-btn ${activeRole === 'teacher' ? 'active' : ''}`} 
                onClick={() => handleRoleChange('teacher')}
              >
                <Presentation /> Teacher / Mentor
              </button>
              <button 
                className={`role-btn ${activeRole === 'admin' ? 'active' : ''}`} 
                onClick={() => handleRoleChange('admin')}
              >
                <ShieldCheck /> Admin System
              </button>
            </div>
          </>
        ) : (
          <span className="role-label" style={{ opacity: 0.7 }}>View mode: {(activeRole || 'student').toUpperCase()}</span>
        )}
      </div>

      <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Switch 
          checkedChildren={<Moon size={14} style={{ marginTop: '4px' }} />}
          unCheckedChildren={<Sun size={14} style={{ marginTop: '2px' }} />}
          checked={isDarkMode}
          onChange={(checked) => setIsDarkMode(checked)}
          style={{ background: isDarkMode ? '#000000' : '#202123' }}
        />
        <span id="current-user-name">{getProfileName()}</span>
        <div className="avatar-circle">{getAvatarText()}</div>
        {currentUser && (
          <button onClick={onLogout} style={{ background: 'transparent', border: 'none', color: isDarkMode ? '#F9FAFB' : '#202123', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
            <LogOut size={16} /> Sign out
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;
