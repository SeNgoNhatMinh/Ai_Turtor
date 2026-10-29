import { ACCOUNT_ROLES } from '../../../constants/roles';
import { useAdminUsersController } from './useAdminUsersController';
import UserAccountsTab from './components/UserAccountsTab';
import MentorsTab from './components/MentorsTab';
import AdminEscalationsTab from './components/AdminEscalationsTab';

const ROLE_BY_SECTION = {
  students: ACCOUNT_ROLES.STUDENT,
  teachers: ACCOUNT_ROLES.TEACHER,
  'senior-mentors': ACCOUNT_ROLES.SENIOR_MENTOR,
  admins: ACCOUNT_ROLES.ADMIN,
};

function AdminUsers({ section = 'students', triggerToast, handleAdminImport }) {
  const controller = useAdminUsersController({
    triggerToast,
    handleAdminImport,
    initialRole: ROLE_BY_SECTION[section] || ACCOUNT_ROLES.STUDENT,
  });

  if (section === 'mentors') {
    return (
      <div className="portal-view">
        <MentorsTab mentors={controller.mentors} />
      </div>
    );
  }

  if (section === 'escalations') {
    return (
      <div className="portal-view">
        <AdminEscalationsTab
          escalations={controller.escalations}
          users={controller.users.list}
        />
      </div>
    );
  }

  return (
    <div className="portal-view">
      <UserAccountsTab users={controller.users} />
    </div>
  );
}

export default AdminUsers;
