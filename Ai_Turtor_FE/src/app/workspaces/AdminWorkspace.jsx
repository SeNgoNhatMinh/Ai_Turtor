import { lazy, Suspense } from 'react';
import AsyncState from '../../components/common/AsyncState';
import FeatureErrorBoundary from '../../components/common/FeatureErrorBoundary';

const adminPages = {
  'admin-dashboard': lazy(() => import('../../features/admin/dashboard/AdminDashboardPage')),
  'admin-users': lazy(() => import('../../features/admin/users/AdminUsersPage')),
  'admin-academic': lazy(() => import('../../features/admin/academic/AdminAcademicPage')),
  'admin-ai-logs': lazy(() => import('../../features/admin/ai-logs/AdminAiLogsPage')),
  'admin-ai-logs-providers': lazy(() => import('../../features/admin/ai-logs/AdminAiLogsPage')),
  'admin-ai-logs-stats': lazy(() => import('../../features/admin/ai-logs/AdminAiLogsPage')),
  'admin-ai-logs-history': lazy(() => import('../../features/admin/ai-logs/AdminAiLogsPage')),
  'admin-answer-cache': lazy(() => import('../../features/admin/answer-cache/AdminAnswerCachePage')),
  'admin-reindex': lazy(() => import('../../features/admin/reindex/AdminReindexPage')),
  'admin-indexed-notes': lazy(() => import('../../features/admin/indexed-teaching-notes/AdminIndexedTeachingNotesPage')),
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
  const aiLogSection = {
    'admin-ai-logs': 'providers',
    'admin-ai-logs-providers': 'providers',
    'admin-ai-logs-stats': 'runtime',
    'admin-ai-logs-history': 'history',
  }[activeTab];

  return (
    <FeatureErrorBoundary featureName="Trang quản trị" key={activeTab}>
      <Suspense fallback={<AdminPageFallback />}>
        <Page
          section={aiLogSection}
          currentUser={currentUser}
          teacherId={currentUser?.userId || currentUser?.id || ''}
          courseId={courseId}
          setCourseId={setCourseId}
          triggerToast={triggerToast}
        />
      </Suspense>
    </FeatureErrorBoundary>
  );
}
