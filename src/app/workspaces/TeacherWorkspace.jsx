import { lazy, Suspense } from 'react';
import AsyncState from '../../components/common/AsyncState';

const teacherPages = {
  'teacher-classes': lazy(() => import('../../features/teacher/classes/TeacherClassesPage')),
  'teacher-quizzes': lazy(() => import('../../features/teacher/quizzes/TeacherQuizzesPage')),
  'teacher-materials': lazy(() => import('../../features/teacher/materials/TeacherMaterialsPage')),
  'teacher-grading': lazy(() => import('../../features/teacher/grading/TeacherGradingPage')),
  'teacher-escalations': lazy(() => import('../../features/teacher/review/TeacherReviewPage')),
  'teacher-expert-training': lazy(() => import('../../features/expert-training/ExpertTrainingPage')),
};

function TeacherPageFallback() {
  return <AsyncState loading loadingLabel="Loading teacher page..." loadingRows={6} />;
}

export default function TeacherWorkspace({
  currentUser,
  activeTab,
  courseId,
  setCourseId,
  classId,
  setClassId,
  triggerToast,
}) {
  const Page = teacherPages[activeTab];
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
      />
    </Suspense>
  );
}
