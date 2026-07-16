import { useCallback, useEffect, useRef, useState } from 'react';
import { assignmentApi } from '../../../services/assignmentApi';
import { quizApi } from '../../../services/quizApi';
import { getUserFacingError } from '../../../services/apiClient';
import { asArray, normalizeQuizSession } from '../../../services/normalizers';

const EMPTY_ATTEMPT_PAGE = {
  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,
};

export function useTeacherGrading({ teacherId, courseId, classId, teacherStudents, triggerToast }) {
  const [teacherSubmissions, setTeacherSubmissions] = useState([]);
  const [quizSubmissions, setQuizSubmissions] = useState([]);
  const [quizAttemptPage, setQuizAttemptPage] = useState(EMPTY_ATTEMPT_PAGE);
  const [quizPage, setQuizPage] = useState(0);
  const [quizReviewStatus, setQuizReviewStatusState] = useState('PENDING');
  const [isQuizSubmissionsLoading, setIsQuizSubmissionsLoading] = useState(false);
  const [loadingQuizDetailId, setLoadingQuizDetailId] = useState('');
  const [selectedTeacherSub, setSelectedTeacherSub] = useState(null);
  const studentLookupRef = useRef(new Map());

  useEffect(() => {
    studentLookupRef.current = new Map(
      (teacherStudents || []).map((student) => [student.id, student]),
    );
    setQuizSubmissions((current) => current.map((attempt) => {
      const student = studentLookupRef.current.get(attempt.studentId);
      return student ? {
        ...attempt,
        studentName: student.name || student.fullName || attempt.studentName,
        studentEmail: student.email || attempt.studentEmail,
      } : attempt;
    }));
  }, [teacherStudents]);

  const loadTeacherSubmissions = async () => {
    if (!courseId || !classId || !teacherId) {
      setTeacherSubmissions([]);
      setSelectedTeacherSub(null);
      return;
    }
    try {
      const data = await assignmentApi.getClassSubmissions(courseId, classId, teacherId);
      const submissions = asArray(data, 'content', 'submissions').map((submission) => {
        const student = studentLookupRef.current.get(submission.studentId || submission.userId);
        return student ? {
          ...submission,
          studentName: student.name || student.fullName || submission.studentName,
          studentEmail: student.email || submission.studentEmail,
        } : submission;
      });
      setTeacherSubmissions(submissions);
      setSelectedTeacherSub((current) => current || submissions[0] || null);
    } catch {
      setTeacherSubmissions([]);
    }
  };

  const loadQuizSubmissions = useCallback(async ({ signal } = {}) => {
    if (!teacherId || !courseId || !classId) {
      setQuizSubmissions([]);
      setQuizAttemptPage(EMPTY_ATTEMPT_PAGE);
      return;
    }
    setIsQuizSubmissionsLoading(true);
    try {
      const response = await quizApi.getTeacherQuizAttempts(teacherId, {
        status: 'SUBMITTED',
        reviewStatus: quizReviewStatus || undefined,
        courseId,
        classId,
        page: quizPage,
        size: 20,
      }, { signal });
      const attempts = response.attempts.map((attempt) => {
        const student = studentLookupRef.current.get(attempt.studentId);
        return {
          ...attempt,
          studentName: student?.name || student?.fullName || attempt.studentName,
          studentEmail: student?.email || attempt.studentEmail,
        };
      });
      setQuizSubmissions(attempts);
      setQuizAttemptPage({
        page: response.page,
        size: response.size,
        totalElements: response.totalElements,
        totalPages: response.totalPages,
      });
      setSelectedTeacherSub((current) => {
        if (!current?.quizSessionId) return current;
        return attempts.some((attempt) => attempt.id === current.id) ? current : null;
      });
    } catch (error) {
      if (error?.name === 'AbortError') return;
      console.error('Failed to load teacher quiz attempts', error);
      setQuizSubmissions([]);
      setQuizAttemptPage(EMPTY_ATTEMPT_PAGE);
      triggerToast(getUserFacingError(error, 'Unable to load quiz attempts for review.'));
    } finally {
      setIsQuizSubmissionsLoading(false);
    }
  }, [classId, courseId, quizPage, quizReviewStatus, teacherId, triggerToast]);

  useEffect(() => {
    const controller = new AbortController();
    // This effect owns the lifecycle of the remote attempt-list request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadQuizSubmissions({ signal: controller.signal });
    return () => controller.abort();
  }, [loadQuizSubmissions]);

  const setQuizReviewStatus = (status) => {
    setQuizReviewStatusState(status);
    setQuizPage(0);
    setSelectedTeacherSub(null);
  };

  const selectQuizSubmission = async (attempt) => {
    const quizSessionId = attempt?.quizSessionId || attempt?.id;
    if (!quizSessionId) return attempt;
    setSelectedTeacherSub(attempt);
    setLoadingQuizDetailId(quizSessionId);
    try {
      const detail = await quizApi.getQuiz(quizSessionId);
      const merged = normalizeQuizSession({ ...attempt, ...detail });
      setSelectedTeacherSub(merged);
      return merged;
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to load this quiz attempt.'));
      return attempt;
    } finally {
      setLoadingQuizDetailId('');
    }
  };

  const handleTeacherQuizReview = async (quizSessionId, reviewedScore, feedback) => {
    try {
      await quizApi.teacherReviewQuiz(quizSessionId, {
        teacherId,
        reviewedScore: Number(reviewedScore),
        feedback,
      });
      triggerToast('Quiz review saved.');
      setQuizSubmissions((current) => current.map((quiz) => (
        quiz.id === quizSessionId
          ? {
              ...quiz,
              teacherReviewedScore: Number(reviewedScore),
              finalScore: Number(reviewedScore),
              finalPercentage: quiz.maxScore
                ? Math.round((Number(reviewedScore) * 10000) / quiz.maxScore) / 100
                : 0,
              teacherFeedback: feedback,
              teacherReviewStatus: 'REVIEWED',
            }
          : quiz
      )));
      setSelectedTeacherSub((current) => current?.id === quizSessionId ? {
        ...current,
        teacherReviewedScore: Number(reviewedScore),
        finalScore: Number(reviewedScore),
        teacherFeedback: feedback,
        teacherReviewStatus: 'REVIEWED',
      } : current);
      if (quizReviewStatus === 'PENDING') {
        await loadQuizSubmissions();
      }
      return true;
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to save quiz review.'));
      return false;
    }
  };

  const handleTeacherGradeSubmit = async (submissionId, score, feedback, weakTopics) => {
    triggerToast('Saving grading results...');
    try {
      await assignmentApi.gradeSubmission(submissionId, {
        teacherId,
        score: parseFloat(score),
        teacherFeedback: feedback,
        weakTopics,
      });
      triggerToast('Submission graded successfully.');
      await loadTeacherSubmissions();
    } catch (error) {
      console.error('Error grading submission:', error);
      triggerToast(getUserFacingError(error, 'Unable to save grading results.'));
    }
  };

  return {
    teacherSubmissions,
    quizSubmissions,
    quizAttemptPage,
    quizPage,
    setQuizPage,
    quizReviewStatus,
    setQuizReviewStatus,
    isQuizSubmissionsLoading,
    loadingQuizDetailId,
    selectedTeacherSub,
    setSelectedTeacherSub,
    selectQuizSubmission,
    loadTeacherSubmissions,
    loadQuizSubmissions,
    handleTeacherQuizReview,
    handleTeacherGradeSubmit,
  };
}
