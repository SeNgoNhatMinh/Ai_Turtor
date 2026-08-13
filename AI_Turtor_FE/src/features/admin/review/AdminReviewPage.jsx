import QualityReviewPage from '../../quality-review/QualityReviewPage';

export default function AdminReviewPage({ currentUser, teacherId, courseId, triggerToast }) {
  return (
    <QualityReviewPage
      currentUser={currentUser}
      reviewerId={teacherId}
      courseId={courseId}
      triggerToast={triggerToast}
      mode="admin"
    />
  );
}
