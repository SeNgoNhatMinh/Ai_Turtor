import { AlertTriangle, GraduationCap, Users as UsersIcon } from 'lucide-react';
import { Tabs } from 'antd';
import { useAdminUsersController } from '../../features/admin/users/useAdminUsersController';
import UserAccountsTab from '../../features/admin/users/components/UserAccountsTab';
import MentorsTab from '../../features/admin/users/components/MentorsTab';
import AdminEscalationsTab from '../../features/admin/users/components/AdminEscalationsTab';

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
  const items = [
    {
      key: 'users',
      label: <TabLabel icon={UsersIcon}>Tài khoản ({controller.users.list.length})</TabLabel>,
      children: <UserAccountsTab users={controller.users} />,
    },
    {
      key: 'mentors',
      label: <TabLabel icon={GraduationCap}>Giảng viên ({controller.mentors.list.length})</TabLabel>,
      children: <MentorsTab mentors={controller.mentors} />,
    },
    {
      key: 'escalations',
      label: <TabLabel icon={AlertTriangle}>Yêu cầu hỗ trợ ({controller.escalations.list.length})</TabLabel>,
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
      <Tabs defaultActiveKey="users" type="card" style={{ marginBottom: 0 }} items={items} />
    </div>
  );
}

export default AdminUsers;
