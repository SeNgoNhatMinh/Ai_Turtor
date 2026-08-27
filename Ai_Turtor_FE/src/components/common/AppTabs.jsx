import { Tabs } from 'antd';
import './AppTabs.css';

export default function AppTabs({ className = '', ...props }) {
  return <Tabs {...props} className={`app-section-tabs ${className}`.trim()} />;
}

