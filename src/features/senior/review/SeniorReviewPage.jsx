import QualityReviewPage from '../../quality-review/QualityReviewPage';

export default function SeniorReviewPage({ currentUser, teacherId, courseId, triggerToast }) {
  return (
    <QualityReviewPage
      currentUser={currentUser}
      reviewerId={teacherId}
      courseId={courseId}
      triggerToast={triggerToast}
      mode="senior"
    />
  );
}
