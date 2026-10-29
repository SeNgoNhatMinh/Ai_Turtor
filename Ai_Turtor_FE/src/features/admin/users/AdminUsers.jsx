import { useState } from 'react';
import {
  AlertTriangle,
  GraduationCap,
  Shield,
  UserCog,
  Users as UsersIcon,
} from 'lucide-react';
import AppTabs from '../../../components/common/AppTabs';
import { ACCOUNT_ROLES } from '../../../constants/roles';
import { useAdminUsersController } from './useAdminUsersController';
import UserAccountsTab from './components/UserAccountsTab';
import MentorsTab from './components/MentorsTab';
import AdminEscalationsTab from './components/AdminEscalationsTab';

const ROLE_TABS = [
  { key: ACCOUNT_ROLES.STUDENT, label: 'Sinh viên', icon: UsersIcon },
  { key: ACCOUNT_ROLES.TEACHER, label: 'Giảng viên', icon: GraduationCap },
  { key: ACCOUNT_ROLES.SENIOR_MENTOR, label: 'Senior Mentor', icon: UserCog },
  { key: ACCOUNT_ROLES.ADMIN, label: 'Quản trị viên', icon: Shield },
];

function TabLabel({ icon: Icon, children }) {
  return (
    <span>
      <Icon size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
      {children}
    </span>
  );
}

function AdminUsers({ triggerToast, handleAdminImport }) {
  const controller = useAdminUsersController({ triggerToast, handleAdminImport });
  const [activeKey, setActiveKey] = useState(ACCOUNT_ROLES.STUDENT);

  const handleTabChange = (key) => {
    setActiveKey(key);
    if (ROLE_TABS.some((tab) => tab.key === key)) {
      controller.users.setRole(key);
    }
  };

  const roleItems = ROLE_TABS.map((tab) => ({
    key: tab.key,
    label: (
      <TabLabel icon={tab.icon}>
        {tab.label} ({controller.users.roleTotals?.[tab.key] || 0})
      </TabLabel>
    ),
    children: activeKey === tab.key ? <UserAccountsTab users={controller.users} /> : null,
  }));

  const items = [
    ...roleItems,
    {
      key: 'mentors',
      label: (
        <TabLabel icon={GraduationCap}>
          Hồ sơ giảng viên ({controller.mentors.list.length})
        </TabLabel>
      ),
      children: <MentorsTab mentors={controller.mentors} />,
    },
    {
      key: 'escalations',
      label: (
        <TabLabel icon={AlertTriangle}>
          Yêu cầu hỗ trợ ({controller.escalations.list.length})
        </TabLabel>
      ),
      children: (
        <AdminEscalationsTab
          escalations={controller.escalations}
          users={controller.users.list}
        />
      ),
    },
  ];

  return (
    <div className="portal-view">
      <AppTabs activeKey={activeKey} onChange={handleTabChange} items={items} />
    </div>
  );
}

export default AdminUsers;
