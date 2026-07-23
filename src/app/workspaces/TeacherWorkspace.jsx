import { lazy, Suspense } from 'react';
import { useMatch } from 'react-router-dom';
import AsyncState from '../../components/common/AsyncState';

const teacherPages = {
  'teacher-classes': lazy(() => import('../../features/teacher/classes/TeacherClassesPage')),
  'teacher-quizzes': lazy(() => import('../../features/teacher/quizzes/TeacherQuizzesPage')),
  'teacher-materials': lazy(() => import('../../features/teacher/materials/TeacherMaterialsPage')),
  'teacher-grading': lazy(() => import('../../features/teacher/grading/TeacherGradingPage')),
  'teacher-escalations': lazy(() => import('../../features/teacher/review/TeacherReviewPage')),
  'senior-v2': lazy(() => import('../../features/expert-training/ExpertTrainingPage')),
};
const TeacherExpertTasksPage = lazy(() => import('../../features/expert-training/TeacherExpertTasksPage'));
const TeacherExpertContributionPage = lazy(() => import('../../features/expert-training/TeacherExpertContributionPage'));

function TeacherPageFallback() {
  return <AsyncState loading loadingLabel="Đang tải trang giảng viên..." loadingRows={6} />;
}

export default function TeacherWorkspace({
  currentUser,
  activeTab,
  courseId,
  setCourseId,
  classId,
  setClassId,
  triggerToast,
  switchTab,
}) {
  const contributionMatch = useMatch('/teacher/expert-tasks/:taskId/contribute');
  const Page = activeTab === 'teacher-expert-training'
    ? contributionMatch ? TeacherExpertContributionPage : TeacherExpertTasksPage
    : teacherPages[activeTab];
  const teacherId = currentUser?.userId || currentUser?.id || '';

  if (!Page) return null;

  return (
    <Suspense fallback={<TeacherPageFallback />}>
      <Page
        currentUser={currentUser}
        teacherId={teacherId}
        courseId={courseId}
        setCourseId={setCourseId}
        classId={classId}
        setClassId={setClassId}
        triggerToast={triggerToast}
        switchTab={switchTab}
      />
    </Suspense>
  );
}
