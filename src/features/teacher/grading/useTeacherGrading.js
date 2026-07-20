import { useCallback, useEffect, useRef, useState } from 'react';
import { assignmentApi } from '../../../services/assignmentApi';
import { assignmentGradingGateway } from '../../ai-harness/assignmentGradingGateway';
import { quizApi } from '../../../services/quizApi';
import { getUserFacingError } from '../../../services/apiClient';
import {
  asArray,
  normalizeAssignment,
  normalizeAssignmentSubmission,
  normalizeQuizSession,
} from '../../../services/normalizers';
import { validateAnswerKeyFile } from '../../../utils/assignmentFiles';
import { useMutationLock } from '../../../hooks/useMutationLock';
import { useRealtimeEvent, useRealtimeReconnect } from '../../realtime/realtimeContext';
import { REALTIME_EVENT_TYPES } from '../../realtime/realtimeEvents';

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
  const [answerKeyUploadingId, setAnswerKeyUploadingId] = useState('');
  const [aiGradingSubmissionId, setAiGradingSubmissionId] = useState('');
  const studentLookupRef = useRef(new Map());
  const { runLocked, lockedKeys } = useMutationLock();

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
      const [submissionData, assignmentData] = await Promise.all([
        assignmentApi.getClassSubmissions(courseId, classId, teacherId),
        assignmentApi.getClassAssignments(courseId, classId, teacherId),
      ]);
      const assignments = asArray(assignmentData, 'content', 'assignments').map(normalizeAssignment);
      const assignmentsById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
      const submissions = asArray(submissionData, 'content', 'submissions').map((rawSubmission) => {
        const submission = normalizeAssignmentSubmission(rawSubmission);
        const assignment = assignmentsById.get(submission.assignmentId) || normalizeAssignment(rawSubmission.assignment);
        const student = studentLookupRef.current.get(submission.studentId || submission.userId);
        return {
          ...assignment,
          ...submission,
          id: submission.id,
          submissionId: submission.id,
          assignment,
          studentName: student?.name || student?.fullName || submission.studentName,
          studentEmail: student?.email || submission.studentEmail,
        };
      });
      setTeacherSubmissions(submissions);
      setSelectedTeacherSub((current) => {
        const currentId = current?.submissionId || current?.id;
        return submissions.find((submission) => submission.id === currentId)
          || submissions[0]
          || null;
      });
    } catch {
      setTeacherSubmissions([]);
    }
  };

  useRealtimeEvent([
    ...REALTIME_EVENT_TYPES.teacherAssignment,
    ...REALTIME_EVENT_TYPES.assignmentAiGrading,
  ], () => {
    loadTeacherSubmissions();
  });

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
      triggerToast(getUserFacingError(error, 'Không thể tải danh sách lượt làm quiz cần duyệt.'));
    } finally {
      setIsQuizSubmissionsLoading(false);
    }
  }, [classId, courseId, quizPage, quizReviewStatus, teacherId, triggerToast]);

  useRealtimeReconnect(() => {
    if (teacherId && courseId && classId) {
      loadTeacherSubmissions();
      loadQuizSubmissions();
    }
  });

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => loadQuizSubmissions({ signal: controller.signal }), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
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
      triggerToast(getUserFacingError(error, 'Không thể tải lượt làm quiz này.'));
      return attempt;
    } finally {
      setLoadingQuizDetailId('');
    }
  };

  const handleTeacherQuizReview = async (quizSessionId, reviewedScore, feedback) => {
    return runLocked(`quiz-review:${quizSessionId}`, async () => {
      try {
        await quizApi.teacherReviewQuiz(quizSessionId, {
          teacherId,
          reviewedScore: Number(reviewedScore),
          feedback,
        });
        triggerToast('Đã lưu kết quả duyệt quiz.');
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
        triggerToast(getUserFacingError(error, 'Không thể lưu kết quả duyệt quiz.'));
        return false;
      }
    });
  };

  const handleTeacherGradeSubmit = async (submissionId, score, feedback, weakTopics) => {
    return runLocked(`assignment-review:${submissionId}`, async () => {
      triggerToast('Đang lưu kết quả chấm bài...');
      try {
        await assignmentApi.gradeSubmission(submissionId, {
          teacherId,
          score: parseFloat(score),
          teacherFeedback: feedback,
          weakTopics,
        });
        triggerToast('Đã lưu điểm bài nộp.');
        await loadTeacherSubmissions();
        return true;
      } catch (error) {
        console.error('Error grading submission:', error);
        triggerToast(getUserFacingError(error, 'Không thể lưu kết quả chấm bài.'));
        return false;
      }
    });
  };

  const handleUploadAnswerKey = async (assignmentId, file) => {
    const validation = validateAnswerKeyFile(file);
    if (!validation.ok) {
      triggerToast(validation.message);
      return false;
    }
    if (!assignmentId || !teacherId) return false;

    return runLocked(`assignment:answer-key:${assignmentId}`, async () => {
      setAnswerKeyUploadingId(assignmentId);
      try {
        await assignmentApi.uploadAssignmentAnswerKey(assignmentId, teacherId, file);
        triggerToast('Đã tải đáp án. Tệp này chỉ giảng viên và backend được truy cập.');
        await loadTeacherSubmissions();
        return true;
      } catch (error) {
        triggerToast(getUserFacingError(error, 'Không thể tải đáp án.'));
        return false;
      } finally {
        setAnswerKeyUploadingId('');
      }
    });
  };

  const handleAiGradeSubmission = async (submission) => {
    const submissionId = submission?.submissionId || submission?.id;
    if (!submissionId || !teacherId) return false;
    if (!submission?.answerKeyUploaded) {
      triggerToast('Hãy tải đáp án trước khi yêu cầu AI hỗ trợ chấm.');
      return false;
    }

    return runLocked(`assignment:ai-grade:${submissionId}`, async () => {
      setAiGradingSubmissionId(submissionId);
      try {
        const response = await assignmentGradingGateway.gradeSubmission({ submissionId, teacherId });
        const result = normalizeAssignmentSubmission(response?.submission || response?.result || response);
        setSelectedTeacherSub((current) => current?.id === submissionId
          ? { ...current, ...result, id: submissionId, submissionId }
          : current);
        triggerToast('Điểm gợi ý của AI đã sẵn sàng. Hãy kiểm tra trước khi lưu điểm cuối.');
        await loadTeacherSubmissions();
        return true;
      } catch (error) {
        triggerToast(getUserFacingError(error, 'AI không thể hoàn tất gợi ý chấm bài. Chưa có điểm cuối nào được lưu.'));
        return false;
      } finally {
        setAiGradingSubmissionId('');
      }
    });
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
    answerKeyUploadingId,
    aiGradingSubmissionId,
    gradingMutationKeys: lockedKeys,
    handleUploadAnswerKey,
    handleAiGradeSubmission,
  };
}
