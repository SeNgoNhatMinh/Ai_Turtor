import { useState } from 'react';
import PageHeader from '../../../components/common/PageHeader';
import { uiCopy } from '../../../constants/uiCopy';
import TeacherGradingTab from './TeacherGradingTab';
import { useTeacherDashboard } from '../dashboard/useTeacherDashboard';
import { useTeacherGrading } from './useTeacherGrading';

export default function TeacherGradingPage({ teacherId, courseId, classId, triggerToast }) {
  const dashboard = useTeacherDashboard({ teacherId, courseId, classId });
  const grading = useTeacherGrading({
    teacherId,
    courseId,
    classId,
    teacherStudents: dashboard.teacherStudents,
    triggerToast,
  });
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');

  const handleSelectSubmission = async (submission) => {
    const selected = await grading.selectQuizSubmission(submission);
    setScore(selected?.teacherReviewedScore ?? selected?.autoScore ?? selected?.score ?? '');
    setFeedback(selected?.teacherFeedback || '');
  };

  const handleTeacherQuizReview = async (quizSessionId, reviewedScore, reviewFeedback) => {
    const succeeded = await grading.handleTeacherQuizReview(quizSessionId, reviewedScore, reviewFeedback);
    if (succeeded) {
      setScore('');
      setFeedback('');
    }
    return succeeded;
  };

  return (
    <div className="portal-section teacher-feature-page">
      <PageHeader eyebrow="Giảng dạy" title={uiCopy.teacher.grading.title} description={uiCopy.teacher.grading.subtitle} />
      <TeacherGradingTab
        quizSubmissions={grading.quizSubmissions}
        quizAttemptPage={grading.quizAttemptPage}
        quizPage={grading.quizPage}
        onQuizPageChange={grading.setQuizPage}
        quizReviewStatus={grading.quizReviewStatus}
        onQuizReviewStatusChange={grading.setQuizReviewStatus}
        isQuizSubmissionsLoading={grading.isQuizSubmissionsLoading}
        loadingQuizDetailId={grading.loadingQuizDetailId}
        selectedTeacherSub={grading.selectedTeacherSub}
        onSelectSubmission={handleSelectSubmission}
        teacherGradeScore={score}
        setTeacherGradeScore={setScore}
        teacherGradeFeedback={feedback}
        setTeacherGradeFeedback={setFeedback}
        handleTeacherQuizReview={handleTeacherQuizReview}
        gradingMutationKeys={grading.gradingMutationKeys}
      />
    </div>
  );
}
