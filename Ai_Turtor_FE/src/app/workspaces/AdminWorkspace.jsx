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
  const pageKey = activeTab.startsWith('admin-users')
    ? 'admin-users'
    : activeTab.startsWith('admin-academic')
      ? 'admin-academic'
      : activeTab.startsWith('admin-ai-logs')
        ? 'admin-ai-logs'
        : activeTab;
  const Page = adminPages[pageKey];
  if (!Page) return null;
  const aiLogSection = {
    'admin-ai-logs': 'providers',
    'admin-ai-logs-providers': 'providers',
    'admin-ai-logs-stats': 'runtime',
    'admin-ai-logs-history': 'history',
  }[activeTab];
  const userSection = {
    'admin-users': 'students',
    'admin-users-students': 'students',
    'admin-users-teachers': 'teachers',
    'admin-users-senior-mentors': 'senior-mentors',
    'admin-users-admins': 'admins',
    'admin-users-mentors': 'mentors',
    'admin-users-escalations': 'escalations',
  }[activeTab];
  const academicSection = {
    'admin-academic': 'semesters',
    'admin-academic-semesters': 'semesters',
    'admin-academic-courses': 'courses',
    'admin-academic-classes': 'classes',
    'admin-academic-enrollments': 'enrollments',
    'admin-academic-import': 'import',
    'admin-academic-materials': 'materials',
    'admin-academic-curriculum': 'curriculum',
  }[activeTab];

  return (
    <FeatureErrorBoundary featureName="Trang quản trị" key={activeTab}>
      <Suspense fallback={<AdminPageFallback />}>
        <Page
          section={aiLogSection || userSection || academicSection}
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
