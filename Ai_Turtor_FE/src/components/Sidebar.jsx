import { useState } from 'react';
import { Button, Menu, Tooltip } from 'antd';
import { ArrowRight, BookOpen, MessageSquareText, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { getNavigationForRole } from '../config/navigation';

function Sidebar({ accountRole, activeRole, activeTab, switchTab, courseId, classId }) {
  const [collapsed, setCollapsed] = useState(false);
  const workspaceCards = {
    teacher: { eyebrow: 'Không gian giảng dạy', title: 'Quản lý lớp học', detail: 'Theo dõi lớp, quiz và bài nộp', button: 'Xem lớp học', tab: 'teacher-classes' },
    senior: { eyebrow: 'Kiểm duyệt chuyên môn', title: 'Senior Mentor', detail: 'Rà soát phản hồi và tri thức AI', button: 'Mở hàng đợi', tab: 'senior-review' },
    admin: { eyebrow: 'Điều hành hệ thống', title: 'Administrator', detail: 'Quản trị người dùng và AI Tutor', button: 'Xem tổng quan', tab: 'admin-dashboard' },
  };
  const workspaceCard = workspaceCards[activeRole];

  const items = getNavigationForRole(accountRole || activeRole).map((item) => {
    const Icon = item.icon;
    return {
      key: item.key,
      icon: <Icon size={18} />,
      label: (
        <Tooltip
          placement="right"
          title={<span className="sidebar-tooltip-text">{item.description}</span>}
          color="#FFFFFF"
          classNames={{ root: 'sidebar-nav-tooltip' }}
          rootClassName="sidebar-nav-tooltip"
        >
          <span>{item.label}</span>
        </Tooltip>
      ),
    };
  });

  return (
    <aside className={`main-sidebar ${collapsed ? 'main-sidebar--collapsed' : ''}`}>
      <div className="sidebar-topbar">
        <Tooltip
          title={<span className="sidebar-tooltip-text">{collapsed ? 'Mở thanh điều hướng' : 'Thu gọn thanh điều hướng'}</span>}
          placement="right"
          color="#FFFFFF"
          classNames={{ root: 'sidebar-nav-tooltip' }}
          rootClassName="sidebar-nav-tooltip"
        >
          <Button
            className="sidebar-collapse-btn"
            type="text"
            icon={collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Mở thanh điều hướng' : 'Thu gọn thanh điều hướng'}
          />
        </Tooltip>
      </div>

      <div className="sidebar-menu-wrap">
        <Menu
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={[activeTab]}
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
          <div className="sidebar-learning-card__icon"><BookOpen size={19} /></div>
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

export default Sidebar;
