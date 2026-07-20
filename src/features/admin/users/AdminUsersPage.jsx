import AdminUsers from '../../../pages/admin/AdminUsers';
import { useMentorImport } from './useMentorImport';
import PageHeader from '../../../components/common/PageHeader';
import { uiCopy } from '../../../constants/uiCopy';

export default function AdminUsersPage({ triggerToast }) {
  const mentorImport = useMentorImport({ triggerToast });

  return (
    <div className="portal-section admin-route-page">
      <PageHeader {...uiCopy.admin.users} />
      <AdminUsers
        triggerToast={triggerToast}
        handleAdminImport={mentorImport.importMentors}
      />
    </div>
  );
}
