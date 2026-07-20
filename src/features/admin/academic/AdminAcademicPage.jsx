import AdminAcademic from '../../../pages/admin/AdminAcademic';
import PageHeader from '../../../components/common/PageHeader';
import { uiCopy } from '../../../constants/uiCopy';

export default function AdminAcademicPage({ currentUser, triggerToast }) {
  return (
    <div className="portal-section admin-route-page">
      <PageHeader {...uiCopy.admin.academic} />
      <AdminAcademic currentUser={currentUser} triggerToast={triggerToast} />
    </div>
  );
}
