import React from 'react';
import { Menu, Tooltip } from 'antd';
import { getNavigationForRole } from '../config/navigation';

function Sidebar({ activeRole, activeTab, switchTab }) {
  const items = getNavigationForRole(activeRole).map((item) => {
    const Icon = item.icon;
    return {
      key: item.key,
      icon: <Icon size={18} />,
      label: (
        <Tooltip placement="right" title={item.description}>
          <span>{item.label}</span>
        </Tooltip>
      ),
    };
  });

  return (
    <aside className="main-sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
        <Menu
          mode="inline"
          selectedKeys={[activeTab]}
          onClick={(e) => switchTab(e.key)}
          items={items}
          style={{ background: 'transparent', borderRight: 'none' }}
          theme="light"
        />
      </div>
      
      <div className="sidebar-status-card" style={{ margin: '16px' }}>
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
      </div>
    </aside>
  );
}

export default Sidebar;
