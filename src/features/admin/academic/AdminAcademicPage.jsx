import AdminAcademic from '../../../pages/admin/AdminAcademic';

export default function AdminAcademicPage({ currentUser, triggerToast }) {
  return (
    <div className="admin-route-page">
      <AdminAcademic currentUser={currentUser} triggerToast={triggerToast} />
    </div>
  );
}
