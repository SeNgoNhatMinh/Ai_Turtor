import AdminAcademic from './AdminAcademicView';
import PageHeader from '../../../components/common/PageHeader';
import { uiCopy } from '../../../constants/uiCopy';

export default function AdminAcademicPage({ section, currentUser, triggerToast }) {
  return (
    <div className="portal-section admin-route-page">
      <PageHeader {...uiCopy.admin.academic} eyebrow="Quản lý học vụ" />
      <AdminAcademic section={section} currentUser={currentUser} triggerToast={triggerToast} />
    </div>
  );
}
