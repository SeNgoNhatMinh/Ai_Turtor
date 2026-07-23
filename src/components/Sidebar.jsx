import { useState } from 'react';
import { Button, Menu, Tooltip } from 'antd';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { getNavigationForRole } from '../config/navigation';

function Sidebar({ accountRole, activeRole, activeTab, switchTab }) {
  const [collapsed, setCollapsed] = useState(false);

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
    </aside>
  );
}

export default Sidebar;
