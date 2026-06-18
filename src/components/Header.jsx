import React from 'react';
import { GraduationCap, Presentation, ShieldCheck, Sun, Moon, LogOut } from 'lucide-react';
import { Switch } from 'antd';

function Header({ activeRole, handleRoleChange, isDarkMode, setIsDarkMode, currentUser, onLogout }) {
  const getProfileName = () => {
    if (currentUser?.fullName) return `${(currentUser.role || activeRole || 'student').toUpperCase()}: ${currentUser.fullName}`;
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
      <div className="logo-area">
        <div className="fpt-text-mark">
          <span className="brand-fpt">FPT</span>
          <span className="brand-university">University</span>
          <small>AI Tutor</small>
        </div>
      </div>
      
      <div className="role-switcher-container">
        {(!currentUser || currentUser.role === 'admin') ? (
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
          unCheckedChildren={<Sun size={14} style={{ marginTop: '4px' }} />}
          checked={isDarkMode}
          onChange={(checked) => setIsDarkMode(checked)}
          style={{ background: isDarkMode ? '#202020' : '#F37021' }}
        />
        <span id="current-user-name">{getProfileName()}</span>
        <div className="avatar-circle">{getAvatarText()}</div>
        {currentUser && (
          <button onClick={onLogout} style={{ background: 'transparent', border: 'none', color: '#F37021', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
            <LogOut size={16} /> Sign out
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;
