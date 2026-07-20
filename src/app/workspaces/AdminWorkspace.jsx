import { lazy, Suspense } from 'react';
import AsyncState from '../../components/common/AsyncState';

const adminPages = {
  'admin-dashboard': lazy(() => import('../../features/admin/dashboard/AdminDashboardPage')),
  'admin-users': lazy(() => import('../../features/admin/users/AdminUsersPage')),
  'admin-academic': lazy(() => import('../../features/admin/academic/AdminAcademicPage')),
  'admin-review': lazy(() => import('../../features/teacher/review/TeacherReviewPage')),
  'admin-expert-training': lazy(() => import('../../features/expert-training/ExpertTrainingPage')),
};

function AdminPageFallback() {
  return <AsyncState loading loadingLabel="Đang tải trang quản trị..." loadingRows={6} />;
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
        teacherId={currentUser?.userId || currentUser?.id || ''}
        courseId={courseId}
        setCourseId={setCourseId}
        triggerToast={triggerToast}
        reviewScope={activeTab === 'admin-review' ? 'admin' : undefined}
      />
    </Suspense>
  );
}
