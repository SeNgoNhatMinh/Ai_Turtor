import GradingSubmissionList from './components/GradingSubmissionList';
import QuizGradingPanel from './components/QuizGradingPanel';
import '../../student/quizzes/Quiz.css';

function TeacherGradingTab({
  quizSubmissions = [],
  quizAttemptPage = {},
  quizPage = 0,
  onQuizPageChange,
  quizReviewStatus = 'PENDING',
  onQuizReviewStatusChange,
  isQuizSubmissionsLoading = false,
  loadingQuizDetailId = '',
  selectedTeacherSub,
  onSelectSubmission,
  teacherGradeScore,
  setTeacherGradeScore,
  teacherGradeFeedback,
  setTeacherGradeFeedback,
  handleTeacherQuizReview,
  gradingMutationKeys = [],
}) {
  const quizReviewSubmitting = gradingMutationKeys.includes(`quiz-review:${selectedTeacherSub?.id || ''}`);

  return (
    <div className="grid-2-cols portal-view">
      <GradingSubmissionList
        submissions={quizSubmissions}
        selectedSubmission={selectedTeacherSub}
        onSelectSubmission={onSelectSubmission}
        quizAttemptPage={quizAttemptPage}
        quizPage={quizPage}
        onQuizPageChange={onQuizPageChange}
        quizReviewStatus={quizReviewStatus}
        onQuizReviewStatusChange={onQuizReviewStatusChange}
        quizLoading={isQuizSubmissionsLoading}
        loadingQuizDetailId={loadingQuizDetailId}
      />

      {selectedTeacherSub && (
        <QuizGradingPanel
          submission={selectedTeacherSub}
          score={teacherGradeScore}
          setScore={setTeacherGradeScore}
          feedback={teacherGradeFeedback}
          setFeedback={setTeacherGradeFeedback}
          loadingDetail={loadingQuizDetailId === selectedTeacherSub.id}
          reviewSubmitting={quizReviewSubmitting}
          onReview={handleTeacherQuizReview}
        />
      )}
    </div>
  );
}

export default TeacherGradingTab;
