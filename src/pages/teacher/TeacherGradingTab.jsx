import { useState } from 'react';
import GradingSubmissionList from '../../features/teacher/grading/components/GradingSubmissionList';
import FileAssignmentGradingPanel from '../../features/teacher/grading/components/FileAssignmentGradingPanel';
import QuizGradingPanel from '../../features/teacher/grading/components/QuizGradingPanel';
import '../student/Quiz.css';

function TeacherGradingTab({
  teacherSubmissions = [],
  quizSubmissions = [],
  quizAttemptPage = {},
  quizPage = 0,
  onQuizPageChange,
  quizReviewStatus = 'PENDING',
  onQuizReviewStatusChange,
  isQuizSubmissionsLoading = false,
  loadingQuizDetailId = '',
  selectedTeacherSub,
  setSelectedTeacherSub,
  onSelectSubmission,
  teacherGradeScore,
  setTeacherGradeScore,
  teacherGradeFeedback,
  setTeacherGradeFeedback,
  teacherGradeWeakTopics,
  setTeacherGradeWeakTopics,
  onGradeSubmit,
  handleTeacherQuizReview,
  handleDownloadSubmission,
  answerKeyUploadingId = '',
  aiGradingSubmissionId = '',
  gradingMutationKeys = [],
  handleUploadAnswerKey,
  handleAiGradeSubmission,
}) {
  const [activeTab, setActiveTab] = useState('assignments');
  const currentList = activeTab === 'assignments' ? teacherSubmissions : quizSubmissions;
  const selectedSubmissionId = selectedTeacherSub?.submissionId || selectedTeacherSub?.id || '';
  const assignmentReviewSubmitting = gradingMutationKeys.includes(`assignment-review:${selectedSubmissionId}`);
  const quizReviewSubmitting = gradingMutationKeys.includes(`quiz-review:${selectedTeacherSub?.id || ''}`);

  const changeTab = (nextTab) => {
    setActiveTab(nextTab);
    setSelectedTeacherSub(null);
  };

  return (
    <div className="grid-2-cols portal-view">
      <GradingSubmissionList
        activeTab={activeTab}
        onTabChange={changeTab}
        submissions={currentList}
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

      {selectedTeacherSub && activeTab === 'assignments' && (
        <FileAssignmentGradingPanel
          submission={selectedTeacherSub}
          score={teacherGradeScore}
          setScore={setTeacherGradeScore}
          feedback={teacherGradeFeedback}
          setFeedback={setTeacherGradeFeedback}
          weakTopics={teacherGradeWeakTopics}
          setWeakTopics={setTeacherGradeWeakTopics}
          onGradeSubmit={onGradeSubmit}
          onDownload={handleDownloadSubmission}
          answerKeyUploadingId={answerKeyUploadingId}
          aiGradingSubmissionId={aiGradingSubmissionId}
          reviewSubmitting={assignmentReviewSubmitting}
          onUploadAnswerKey={handleUploadAnswerKey}
          onAiGrade={handleAiGradeSubmission}
        />
      )}

      {selectedTeacherSub && activeTab === 'quizzes' && (
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
