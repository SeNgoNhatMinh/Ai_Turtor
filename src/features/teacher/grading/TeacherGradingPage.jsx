import { useEffect, useState } from 'react';
import TeacherGradingTab from '../../../pages/teacher/TeacherGradingTab';
import { assignmentApi } from '../../../services/assignmentApi';
import { getUserFacingError } from '../../../services/apiClient';
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
  const [weakTopics, setWeakTopics] = useState([]);

  useEffect(() => {
    dashboard.loadTeacherDashboard();
    grading.loadTeacherSubmissions();
    // Grading data is isolated to this route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, courseId, classId]);

  const handleGradeSubmit = (event) => {
    event.preventDefault();
    const submissionId = grading.selectedTeacherSub?.id || grading.selectedTeacherSub?.submissionId;
    if (!submissionId) return;
    grading.handleTeacherGradeSubmit(submissionId, score, feedback, weakTopics).then((succeeded) => {
      if (succeeded) {
        setScore('');
        setFeedback('');
        setWeakTopics([]);
      }
    });
  };

  const handleSelectSubmission = async (submission, type) => {
    let selected = submission;
    if (type === 'quizzes') {
      selected = await grading.selectQuizSubmission(submission);
    } else {
      grading.setSelectedTeacherSub(submission);
    }
    setScore(type === 'assignments'
      ? (selected?.score ?? '')
      : (selected?.teacherReviewedScore ?? selected?.autoScore ?? selected?.score ?? ''));
    setFeedback(selected?.teacherFeedback || '');
    if (type === 'assignments') {
      setWeakTopics(selected?.weakTopics || []);
    }
  };

  const handleTeacherQuizReview = async (quizSessionId, reviewedScore, reviewFeedback) => {
    const succeeded = await grading.handleTeacherQuizReview(quizSessionId, reviewedScore, reviewFeedback);
    if (succeeded) {
      setScore('');
      setFeedback('');
    }
    return succeeded;
  };

  const handleDownloadSubmission = async (submission) => {
    const submissionId = submission?.id || submission?.submissionId || submission;
    if (!submissionId) return;
    try {
      const blob = await assignmentApi.downloadSubmissionFile(submissionId);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = submission?.submittedFileName || `submission-${submissionId}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Unable to download this submission.'));
    }
  };

  return (
    <TeacherGradingTab
      teacherSubmissions={grading.teacherSubmissions}
      quizSubmissions={grading.quizSubmissions}
      quizAttemptPage={grading.quizAttemptPage}
      quizPage={grading.quizPage}
      onQuizPageChange={grading.setQuizPage}
      quizReviewStatus={grading.quizReviewStatus}
      onQuizReviewStatusChange={grading.setQuizReviewStatus}
      isQuizSubmissionsLoading={grading.isQuizSubmissionsLoading}
      loadingQuizDetailId={grading.loadingQuizDetailId}
      selectedTeacherSub={grading.selectedTeacherSub}
      setSelectedTeacherSub={grading.setSelectedTeacherSub}
      onSelectSubmission={handleSelectSubmission}
      teacherGradeScore={score}
      setTeacherGradeScore={setScore}
      teacherGradeFeedback={feedback}
      setTeacherGradeFeedback={setFeedback}
      teacherGradeWeakTopics={weakTopics}
      setTeacherGradeWeakTopics={setWeakTopics}
      onGradeSubmit={handleGradeSubmit}
      handleTeacherQuizReview={handleTeacherQuizReview}
      handleDownloadSubmission={handleDownloadSubmission}
      answerKeyUploadingId={grading.answerKeyUploadingId}
      aiGradingSubmissionId={grading.aiGradingSubmissionId}
      gradingMutationKeys={grading.gradingMutationKeys}
      handleUploadAnswerKey={grading.handleUploadAnswerKey}
      handleAiGradeSubmission={grading.handleAiGradeSubmission}
    />
  );
}
