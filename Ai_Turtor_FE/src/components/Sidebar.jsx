import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Menu, Tooltip } from 'antd';
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
} from 'lucide-react';
import {
  findOpenMenuKey,
  getNavigationForRole,
  groupAdminNavigation,
  resolveNavigationSelection,
} from '../config/navigation';

function Sidebar({ accountRole, activeRole, activeTab, switchTab, courseId, classId, compactByDefault = false }) {
  const [collapsed, setCollapsed] = useState(compactByDefault);
  const compactByDefaultRef = useRef(compactByDefault);

  // Shrinking the window (desktop -> tablet/phone widths) must collapse the
  // rail fully instead of leaving the expanded sidebar mounted at mount-time state.
  useEffect(() => {
    const wasCompact = compactByDefaultRef.current;
    compactByDefaultRef.current = compactByDefault;
    if (compactByDefault && !wasCompact) {
      setCollapsed(true);
    }
  }, [compactByDefault]);
  const workspaceCards = {
    teacher: { eyebrow: 'Không gian giảng dạy', title: 'Quản lý lớp học', detail: 'Theo dõi lớp, quiz và bài nộp', button: 'Xem lớp học', tab: 'teacher-classes', icon: GraduationCap },
    senior: { eyebrow: 'Kiểm duyệt chuyên môn', title: 'Senior Mentor', detail: 'Rà soát phản hồi và tri thức AI', button: 'Mở hàng đợi', tab: 'senior-review', icon: ShieldCheck },
  };
  const workspaceCard = workspaceCards[activeRole];
  const WorkspaceIcon = workspaceCard?.icon;

  const navigation = useMemo(
    () => getNavigationForRole(accountRole || activeRole),
    [accountRole, activeRole],
  );
  const selectedKey = resolveNavigationSelection(activeTab);
  const openParentKey = findOpenMenuKey(navigation, selectedKey);
  const [openKeys, setOpenKeys] = useState([]);
  const menuOpenKeys = openParentKey && !openKeys.includes(openParentKey)
    ? [...openKeys, openParentKey]
    : openKeys;
  const items = useMemo(() => {
    const label = (text, description) => (
      <Tooltip
        placement="right"
        title={<span className="sidebar-tooltip-text">{description}</span>}
        color="#FFFFFF"
        classNames={{ root: 'sidebar-nav-tooltip' }}
        rootClassName="sidebar-nav-tooltip"
      >
        <span>{text}</span>
      </Tooltip>
    );
    const toMenuItem = (item) => {
      if (item.type === 'group') {
        return {
          type: 'group',
          key: item.key,
          label: item.label,
          children: item.children.map(toMenuItem),
        };
      }
      const Icon = item.icon;
      return {
        key: item.key,
        icon: Icon ? <Icon size={18} /> : undefined,
        label: label(item.label, item.description),
        children: item.children?.map((child) => ({
          key: child.key,
          label: label(child.label, child.description),
        })),
      };
    };
    return groupAdminNavigation(navigation).map(toMenuItem);
  }, [navigation]);

  return (
    <aside
      className={`main-sidebar ${collapsed ? 'main-sidebar--collapsed' : 'main-sidebar--expanded'}`}
      aria-label="Thanh điều hướng chính"
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <div className="sidebar-topbar">
        <Tooltip
          title={<span className="sidebar-tooltip-text">{collapsed ? 'Mở thanh điều hướng' : 'Thu gọn thanh điều hướng'}</span>}
          placement="right"
          color="#FFFFFF"
          classNames={{ root: 'sidebar-nav-tooltip' }}
          rootClassName="sidebar-nav-tooltip"
        >
          <button
            type="button"
            className="sidebar-collapse-control"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Mở thanh điều hướng' : 'Thu gọn thanh điều hướng'}
            aria-expanded={!collapsed}
            aria-controls="desktop-primary-navigation"
          >
            {collapsed ? <PanelLeftOpen size={20} aria-hidden="true" /> : <PanelLeftClose size={20} aria-hidden="true" />}
          </button>
        </Tooltip>
      </div>

      <div className="sidebar-menu-wrap" id="desktop-primary-navigation">
        <Menu
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={[selectedKey]}
          openKeys={collapsed ? undefined : menuOpenKeys}
          onOpenChange={setOpenKeys}
          onClick={(e) => switchTab(e.key)}
          items={items}
          style={{ background: 'transparent', borderRight: 'none' }}
          theme="light"
        />
      </div>
      {activeRole === 'student' && (
        <div className="sidebar-learning-card">
          <div className="sidebar-learning-card__icon"><BookOpen size={19} /></div>
          <div className="sidebar-learning-card__content">
            <small>Môn học hiện tại</small>
            <strong>{courseId || 'Chưa chọn môn'}</strong>
            <span>{classId ? `Lớp ${classId}` : 'Chọn môn để bắt đầu học'}</span>
          </div>
          <button type="button" onClick={() => switchTab('student-chat')} aria-label="Mở trò chuyện AI Tutor">
            <MessageSquareText size={16} /><span>Hỏi AI Tutor</span><ArrowRight size={15} />
          </button>
        </div>
      )}
      {workspaceCard && (
        <div className={`sidebar-learning-card sidebar-role-card sidebar-role-card--${activeRole}`}>
          <div className="sidebar-learning-card__icon"><WorkspaceIcon size={19} aria-hidden="true" /></div>
          <div className="sidebar-learning-card__content">
            <small>{workspaceCard.eyebrow}</small>
            <strong>{workspaceCard.title}</strong>
            <span>{workspaceCard.detail}</span>
          </div>
          <button type="button" onClick={() => switchTab(workspaceCard.tab)}>
            <span>{workspaceCard.button}</span><ArrowRight size={15} />
          </button>
        </div>
      )}
    </aside>
  );
}

export default memo(Sidebar);
