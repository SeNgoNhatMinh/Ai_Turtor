import { lazy, Suspense } from 'react';
import AsyncState from '../../components/common/AsyncState';

const seniorPages = {
  'senior-review': lazy(() => import('../../features/senior/review/SeniorReviewPage')),
  'senior-v2': lazy(() => import('../../features/senior/expert-training/SeniorExpertTrainingPage')),
};

function SeniorPageFallback() {
  return <AsyncState loading loadingLabel="Đang tải không gian kiểm duyệt..." loadingRows={6} />;
}

export default function SeniorWorkspace({
  activeTab,
  currentUser,
  courseId,
  setCourseId,
  triggerToast,
}) {
  const Page = seniorPages[activeTab];
  if (!Page) return null;

  return (
    <Suspense fallback={<SeniorPageFallback />}>
      <Page
        currentUser={currentUser}
        teacherId={currentUser?.userId || currentUser?.id || ''}
        courseId={courseId}
        setCourseId={setCourseId}
        triggerToast={triggerToast}
      />
    </Suspense>
  );
}
