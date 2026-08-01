import AdminAcademic from './AdminAcademicView';
import PageHeader from '../../../components/common/PageHeader';
import { uiCopy } from '../../../constants/uiCopy';

export default function AdminAcademicPage({ currentUser, triggerToast }) {
  return (
    <div className="portal-section admin-route-page">
      <PageHeader {...uiCopy.admin.academic} eyebrow="Quản lý học vụ" />
      <AdminAcademic currentUser={currentUser} triggerToast={triggerToast} />
    </div>
  );
}
