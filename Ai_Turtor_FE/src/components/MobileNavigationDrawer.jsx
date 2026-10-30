import { memo, useMemo, useState } from 'react';
import { Drawer, Menu } from 'antd';
import { LogOut, Search, UserRound, X } from 'lucide-react';
import {
  findOpenMenuKey,
  getNavigationForRole,
  groupAdminNavigation,
  resolveNavigationSelection,
} from '../config/navigation';
import { getAccountRoleLabel, normalizeAccountRole } from '../constants/roles';
import { includesSearchText } from '../utils/searchText';
import FptBrand from './common/FptBrand';
import './MobileNavigationDrawer.css';

function MobileNavigationDrawer({
  open,
  onClose,
  accountRole,
  activeRole,
  activeTab,
  switchTab,
  currentUser,
  courseId,
  classId,
  onLogout,
  onOpenProfile,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const normalizedRole = normalizeAccountRole(accountRole || activeRole);
  const roleLabel = getAccountRoleLabel(normalizedRole);
  const navigation = useMemo(() => getNavigationForRole(normalizedRole), [normalizedRole]);
  const selectedKey = resolveNavigationSelection(activeTab);
  const openParentKey = findOpenMenuKey(navigation, selectedKey);
  const items = useMemo(() => {
    const filtered = navigation.flatMap((item) => {
      const children = (item.children || []).filter((child) => (
        includesSearchText(`${item.label} ${child.label} ${child.description}`, searchQuery)
      ));
      const selfMatch = includesSearchText(`${item.label} ${item.description}`, searchQuery);
      if (searchQuery && !selfMatch && children.length === 0) return [];
      return [{
        ...item,
        children: item.children ? (searchQuery && !selfMatch ? children : item.children) : undefined,
      }];
    });
    const toMenuItem = (item) => {
      if (item.type === 'group') {
        return {
          type: 'group',
          key: item.key,
          label: item.label,
          children: item.children.map(toMenuItem),
        };
      }
      return {
        key: item.key,
        icon: item.icon ? <item.icon size={20} aria-hidden="true" /> : undefined,
        label: item.label,
        children: item.children?.map((child) => ({
          key: child.key,
          label: child.label,
        })),
      };
    };
    return groupAdminNavigation(filtered).map(toMenuItem);
  }, [navigation, searchQuery]);

  const navigate = ({ key }) => {
    switchTab(key);
    onClose();
  };

  return (
    <Drawer
      className="mobile-navigation-drawer"
      rootClassName={`mobile-navigation-drawer-root role-${activeRole}`}
      placement="left"
      size={360}
      open={open}
      onClose={onClose}
      title={<FptBrand compact />}
      aria-label="Điều hướng chính"
    >
      <div className="mobile-navigation-drawer__profile">
        <div className="mobile-navigation-drawer__avatar" aria-hidden="true">
          {(currentUser?.fullName || roleLabel).slice(0, 2).toUpperCase()}
        </div>
        <div>
          <strong>{currentUser?.fullName || roleLabel}</strong>
          <span>{roleLabel}</span>
        </div>
      </div>

      {activeRole === 'student' && (
        <div className="mobile-navigation-drawer__context">
          <span>Môn học hiện tại</span>
          <strong>{courseId || 'Chưa chọn môn'}</strong>
          <small>{classId ? `Lớp ${classId}` : 'Chưa chọn lớp'}</small>
        </div>
      )}

      <label className="mobile-navigation-drawer__search">
        <Search size={19} aria-hidden="true" />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Tìm chức năng"
          aria-label="Tìm chức năng trong menu"
        />
        {searchQuery && (
          <button type="button" onClick={() => setSearchQuery('')} aria-label="Xóa nội dung tìm kiếm">
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </label>

      <nav className="mobile-navigation-drawer__menu" aria-label={`Menu ${roleLabel}`}>
        {items.length ? (
          <Menu
            key={`${normalizedRole}:${openParentKey || 'root'}`}
            mode="inline"
            selectedKeys={[selectedKey]}
            defaultOpenKeys={openParentKey ? [openParentKey] : []}
            items={items}
            onClick={navigate}
          />
        ) : (
          <p className="mobile-navigation-drawer__empty">Không tìm thấy chức năng phù hợp.</p>
        )}
      </nav>

      <div className="mobile-navigation-drawer__footer">
        <button type="button" onClick={onOpenProfile} disabled={!currentUser}>
          <UserRound size={20} aria-hidden="true" />
          <span>Hồ sơ & bảo mật</span>
        </button>
        <button type="button" className="is-danger" onClick={onLogout}>
          <LogOut size={20} aria-hidden="true" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </Drawer>
  );
}

export default memo(MobileNavigationDrawer);
