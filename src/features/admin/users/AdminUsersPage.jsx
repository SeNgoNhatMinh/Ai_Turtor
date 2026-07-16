import AdminUsers from '../../../pages/admin/AdminUsers';
import { useMentorImport } from './useMentorImport';

export default function AdminUsersPage({ triggerToast }) {
  const mentorImport = useMentorImport({ triggerToast });

  return (
    <div className="admin-route-page">
      <AdminUsers
        triggerToast={triggerToast}
        handleAdminImport={mentorImport.importMentors}
      />
    </div>
  );
}
