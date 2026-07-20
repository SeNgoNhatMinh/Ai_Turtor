import { lazy, Suspense } from 'react';
import AsyncState from '../../components/common/AsyncState';
import '../../features/admin/admin-route.css';

const adminPages = {
  'admin-dashboard': lazy(() => import('../../features/admin/dashboard/AdminDashboardPage')),
  'admin-users': lazy(() => import('../../features/admin/users/AdminUsersPage')),
  'admin-academic': lazy(() => import('../../features/admin/academic/AdminAcademicPage')),
  'admin-expert-training': lazy(() => import('../../features/expert-training/ExpertTrainingPage')),
};

function AdminPageFallback() {
  return <AsyncState loading loadingLabel="Loading admin page..." loadingRows={6} />;
}

export default function AdminWorkspace({
  activeTab,
  currentUser,
  courseId,
  setCourseId,
  triggerToast,
}) {
  const Page = adminPages[activeTab];
  if (!Page) return null;

  return (
    <Suspense fallback={<AdminPageFallback />}>
      <Page
        currentUser={currentUser}
        courseId={courseId}
        setCourseId={setCourseId}
        triggerToast={triggerToast}
      />
    </Suspense>
  );
}
