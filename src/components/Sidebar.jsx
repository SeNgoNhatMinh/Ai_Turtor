import React, { useState } from 'react';
import { Button, Menu, Tooltip } from 'antd';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { getNavigationForRole } from '../config/navigation';

function Sidebar({ activeRole, activeTab, switchTab }) {
  const [collapsed, setCollapsed] = useState(false);

  const items = getNavigationForRole(activeRole).map((item) => {
    const Icon = item.icon;
    return {
      key: item.key,
      icon: <Icon size={18} />,
      label: (
        <Tooltip
          placement="right"
          title={<span className="sidebar-tooltip-text">{item.description}</span>}
          color="#FFFFFF"
          overlayClassName="sidebar-nav-tooltip"
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
          title={<span className="sidebar-tooltip-text">{collapsed ? 'Open sidebar' : 'Close sidebar'}</span>}
          placement="right"
          color="#FFFFFF"
          overlayClassName="sidebar-nav-tooltip"
          rootClassName="sidebar-nav-tooltip"
        >
          <Button
            className="sidebar-collapse-btn"
            type="text"
            icon={collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Open sidebar' : 'Close sidebar'}
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
      
      {!collapsed && <div className="sidebar-status-card">
        <div className="status-row">
          <span className="status-dot green"></span>
          <span className="status-text">Backend API Connected</span>
        </div>
        <div className="status-row">
          <span className="status-dot green"></span>
          <span className="status-text">MongoDB Running</span>
        </div>
        <div className="status-row">
          <span className="status-dot green"></span>
          <span className="status-text">Elasticsearch Ready</span>
        </div>
      </div>}
    </aside>
  );
}

export default Sidebar;
