import { useEffect, useState } from 'react';
import { assignmentApi } from '../services/assignmentApi';
import { getUserFacingError } from '../services/apiClient';
import { n8nService } from '../services/n8nService';
import { N8N_ENABLED, N8N_STRICT } from '../services/n8nClient';
import { quizApi } from '../services/quizApi';
import { teacherApi } from '../services/teacherApi';
import { teacherReviewApi } from '../services/teacherReviewApi';
import {
  asArray,
  normalizeAnswerReview,
  normalizeTeacherDashboard,
  normalizeTeacherInboxItem,
} from '../services/normalizers';
import { normalizeAccountRole } from '../constants/roles';

export function useTeacherRuntimeController({
  currentUser,
  activeRole,
  courseId,
  classId,
  triggerToast,
}) {
  const currentUserId = currentUser?.userId || currentUser?.id || '';
  const getTeacherUserId = () => currentUserId;
  const getCurrentUserId = () => currentUserId;

  const [classesList, setClassesList] = useState([]);
  const [teacherStudents, setTeacherStudents] = useState([]);
  const [teacherTopicHeatmap, setTeacherTopicHeatmap] = useState([]);
  const [teacherDashboardLoading, setTeacherDashboardLoading] = useState(false);
  const [teacherSubmissions, setTeacherSubmissions] = useState([]);
  const [quizSubmissions, setQuizSubmissions] = useState([]);
  const [selectedTeacherSub, setSelectedTeacherSub] = useState(null);

  const [escalations, setEscalations] = useState([]);
  const [isTeacherInboxLoading, setIsTeacherInboxLoading] = useState(false);
  const [selectedEscalation, setSelectedEscalation] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [answerReviews, setAnswerReviews] = useState([]);
  const [seniorAnswerReviews, setSeniorAnswerReviews] = useState([]);
  const [pendingCandidateActionIds, setPendingCandidateActionIds] = useState([]);
  const [pendingSeniorReviewIds, setPendingSeniorReviewIds] = useState([]);

  const loadTeacherSubmissions = async () => {
    if (!courseId || !classId || !getTeacherUserId()) {
      setTeacherSubmissions([]);
      setSelectedTeacherSub(null);
      return;
    }
    try {
      const data = await assignmentApi.getClassSubmissions(courseId, classId, getTeacherUserId());
      const subList = asArray(data, 'content', 'submissions');
      setTeacherSubmissions(subList);
      setSelectedTeacherSub((current) => current || subList[0] || null);
    } catch {
      setTeacherSubmissions([]);
    }
  };

  useEffect(() => {
    let isCancelled = false;
    const loadQuizzes = async () => {
      if (activeRole !== 'teacher' || teacherStudents.length === 0 || !courseId) {
        await Promise.resolve();
        if (!isCancelled) setQuizSubmissions([]);
        return;
      }

      try {
        const allQuizzes = await Promise.all(
          teacherStudents.map((student) =>
            quizApi.getStudentQuizHistory(student.id, courseId)
              .catch(() => ({ quizzes: [] }))
          )
        );
        if (isCancelled) return;
        const aggregated = allQuizzes.flatMap((res, index) => {
          const studentQuizzes = Array.isArray(res) ? res : (res?.quizzes || []);
          const studentInfo = teacherStudents[index];
          return studentQuizzes.map((quiz) => ({
            ...quiz,
            studentName: studentInfo.name,
            studentEmail: studentInfo.email,
          }));
        });
        setQuizSubmissions(aggregated.filter((quiz) => quiz.status === 'SUBMITTED' || quiz.status === 'REVIEWED'));
      } catch (error) {
        console.error('Failed to load quiz submissions for grading', error);
      }
    };

    loadQuizzes();
    return () => {
      isCancelled = true;
    };
  }, [teacherStudents, activeRole, courseId]);

  const loadTeacherDashboard = async () => {
    if (!getTeacherUserId()) {
      setClassesList([]);
      setTeacherStudents([]);
      setTeacherTopicHeatmap([]);
      return;
    }
    setTeacherDashboardLoading(true);
    try {
      const data = await teacherApi.getDashboard(getTeacherUserId(), courseId, classId);
      const normalized = normalizeTeacherDashboard(data);
      setTeacherTopicHeatmap(normalized.topicHeatmap);

      const sections = normalized.classSections;
      if (sections.length) {
        setClassesList(sections.map((section) => ({
          semester: section.semesterId || section.semesterCode || '—',
          course: section.courseId || courseId,
          classCode: section.classId || section.id,
          name: section.name || `Class ${section.courseId}_${section.classId}`,
          details: section.description || `${section.studentCount ?? '—'} students`,
        })));
      } else {
        const fallback = await teacherApi.getClassSections(getTeacherUserId());
        const list = asArray(fallback, 'content', 'classSections');
        setClassesList(list.map((section) => ({
          semester: section.semesterId || '—',
          course: section.courseId || courseId,
          classCode: section.classId || section.id,
          name: section.name || `Class ${section.courseId}_${section.classId}`,
          details: `${section.studentCount ?? '—'} students`,
        })));
      }

      if (normalized.students.length) {
        setTeacherStudents(normalized.students.map((student) => ({
          id: student.studentId || student.id || student.userId,
          name: student.fullName || student.name || student.studentId,
          email: student.email || '—',
          status: student.status || 'ACTIVE',
          weakTopics: student.weakTopics?.length ? student.weakTopics : ['None'],
        })));
      } else {
        try {
          if (!courseId || !classId) {
            setTeacherStudents([]);
            return;
          }
          const studentsData = await teacherApi.getClassStudents(courseId, classId);
          const students = asArray(studentsData, 'students', 'content');
          setTeacherStudents(students.map((student) => ({
            id: student.studentId || student.id,
            name: student.fullName || student.name || student.studentId,
            email: student.email || '—',
            status: student.status || 'ACTIVE',
            weakTopics: student.weakTopics?.length ? student.weakTopics : ['None'],
          })));
        } catch {
          setTeacherStudents([]);
        }
      }
    } catch {
      setTeacherStudents([]);
      setTeacherTopicHeatmap([]);
    } finally {
      setTeacherDashboardLoading(false);
    }
  };

  const loadTeacherInbox = async () => {
    setIsTeacherInboxLoading(true);
    try {
      const data = await teacherReviewApi.getTeacherEscalations(getTeacherUserId(), { courseId });
      const items = asArray(data, 'escalations', 'inbox', 'content').map(normalizeTeacherInboxItem);
      setEscalations(items);
      setSelectedEscalation((current) => current || items[0] || null);
    } catch {
      setEscalations([]);
    } finally {
      setIsTeacherInboxLoading(false);
    }
  };

  const loadAnswerReviews = async () => {
    try {
      const [mentorPending, seniorPending] = await Promise.all([
        teacherReviewApi.getMentorPendingAnswerReviews(courseId),
        teacherReviewApi.getSeniorPendingAnswerReviews(courseId),
      ]);
      setAnswerReviews((Array.isArray(mentorPending) ? mentorPending : []).map(normalizeAnswerReview));
      setSeniorAnswerReviews((Array.isArray(seniorPending) ? seniorPending : []).map(normalizeAnswerReview));
    } catch {
      setAnswerReviews([]);
      setSeniorAnswerReviews([]);
    }
  };

  const loadKnowledgeCandidates = async () => {
    try {
      const data = await teacherReviewApi.getKnowledgeCandidates('PENDING_SENIOR_REVIEW', courseId);
      setCandidates(asArray(data, 'candidates', 'content'));
    } catch (error) {
      setCandidates([]);
      triggerToast(getUserFacingError(error, 'Unable to load suggested AI answers.'));
    }
  };

  const handleTeacherQuizReview = async (quizSessionId, reviewedScore, feedback) => {
    try {
      await quizApi.teacherReviewQuiz(quizSessionId, {
        teacherId: getTeacherUserId(),
        reviewedScore: Number(reviewedScore),
        feedback,
      });
      triggerToast('Quiz review saved.');
      setQuizSubmissions((prev) => prev.map((quiz) =>
        quiz.id === quizSessionId
          ? { ...quiz, teacherReviewedScore: Number(reviewedScore), teacherFeedback: feedback, teacherReviewStatus: 'REVIEWED' }
          : quiz
      ));
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to save quiz review.'));
    }
  };

  const handleTeacherGradeSubmit = async (submissionId, score, feedback, weakTopics) => {
    triggerToast('Saving grading results...');
    try {
      await assignmentApi.gradeSubmission(submissionId, {
        teacherId: getTeacherUserId(),
        score: parseFloat(score),
        teacherFeedback: feedback,
        weakTopics,
      });
      triggerToast('Submission graded successfully.');
      loadTeacherSubmissions();
    } catch (error) {
      console.error('Error grading submission:', error);
      triggerToast(getUserFacingError(error, 'Unable to save grading results.'));
    }
  };

  const handleTeacherAnswerEsc = async (escalationId, reply, createKnowledgeCandidate = false, candidateType = 'ACADEMIC_KNOWLEDGE') => {
    triggerToast('Sending answer...');
    try {
      if (N8N_ENABLED) {
        try {
          await n8nService.submitTeacherAnswer({
            questionEscalationId: escalationId,
            teacherId: getTeacherUserId(),
            teacherName: currentUser?.fullName || currentUser?.name || 'Teacher',
            answer: reply,
            createKnowledgeCandidate,
            candidateType,
          });
          triggerToast('Answer sent successfully.');
        } catch (n8nErr) {
          if (N8N_STRICT) throw n8nErr;
          console.warn('n8n teacher answer failed, falling back to backend API:', n8nErr);
          await teacherReviewApi.answerEscalation(escalationId, {
            teacherId: getTeacherUserId(),
            teacherName: currentUser?.fullName || currentUser?.name || 'Teacher',
            answer: reply,
            createKnowledgeCandidate,
            candidateType,
          });
          triggerToast('Answer sent successfully.');
        }
      } else {
        await teacherReviewApi.answerEscalation(escalationId, {
          teacherId: getTeacherUserId(),
          teacherName: currentUser?.fullName || currentUser?.name || 'Teacher',
          answer: reply,
          createKnowledgeCandidate,
          candidateType,
        });
        triggerToast('Answer sent successfully.');
      }

      setEscalations((prev) => prev.map((item) => (
        item.id === escalationId
          ? {
              ...item,
              status: createKnowledgeCandidate
                ? 'ANSWERED_PENDING_SENIOR_REVIEW'
                : 'ANSWERED_NO_KNOWLEDGE_CANDIDATE',
            }
          : item
      )));
      await Promise.all([
        loadTeacherInbox(),
        createKnowledgeCandidate ? loadKnowledgeCandidates() : Promise.resolve(),
      ]);
    } catch (error) {
      console.error('Error sending answer:', error);
      triggerToast(getUserFacingError(error, 'Unable to send answer. Please try again.'));
      await Promise.allSettled([
        loadTeacherInbox(),
        createKnowledgeCandidate ? loadKnowledgeCandidates() : Promise.resolve(),
      ]);
    }
  };

  const handleMentorReviewAnswer = async (review, accurate, feedback) => {
    triggerToast('Submitting AI answer review...');
    try {
      await teacherReviewApi.submitAnswerReview({
        studentId: review.studentId,
        courseId: review.courseId || courseId,
        classId: review.classId || classId,
        conversationId: review.conversationId,
        questionEscalationId: review.questionEscalationId,
        mode: review.mode || 'RAG',
        reviewType: review.reviewType || 'ANSWER_DISPUTE',
        question: review.question,
        answer: review.answer,
        accurate,
        helpful: accurate,
        correctnessLevel: accurate ? 'HIGH' : 'INCORRECT',
        feedback,
        reviewedBy: getTeacherUserId(),
        reviewerRole: normalizeAccountRole(currentUser?.originalRole || currentUser?.role || 'TEACHER'),
      });
      triggerToast(accurate ? 'Review submitted — AI answer confirmed.' : 'Review submitted — correction noted.');
      loadAnswerReviews();
    } catch (error) {
      console.error('Error submitting mentor review:', error);
      triggerToast(getUserFacingError(error, 'Unable to submit review. Please try again.'));
    }
  };

  const handleSeniorResolveReview = async (reviewId, decision, notes, correctedAnswer = '') => {
    if (pendingSeniorReviewIds.includes(reviewId)) return false;
    setPendingSeniorReviewIds((current) => [...current, reviewId]);
    triggerToast('Resolving senior review...');
    try {
      const reviewerRole = normalizeAccountRole(currentUser?.originalRole || currentUser?.role);
      const payload = {
        reviewId,
        seniorReviewerId: getTeacherUserId(),
        seniorReviewerName: currentUser?.fullName || currentUser?.name || 'Senior Mentor',
        reviewerRole,
        decision,
        notes,
        createKnowledgeCandidate: decision === 'CREATE_KNOWLEDGE_CANDIDATE',
        candidateType: 'ACADEMIC_KNOWLEDGE',
        ...(decision === 'CREATE_KNOWLEDGE_CANDIDATE' ? { correctedAnswer } : {}),
      };
      if (N8N_ENABLED) {
        try {
          await n8nService.submitSeniorReviewResolution(payload);
        } catch (n8nError) {
          if (N8N_STRICT) throw n8nError;
          console.warn('n8n senior review resolution failed, falling back to backend API:', n8nError);
          await teacherReviewApi.seniorResolveAnswerReview(reviewId, payload);
        }
      } else {
        await teacherReviewApi.seniorResolveAnswerReview(reviewId, payload);
      }
      triggerToast('Senior review resolved.');
      await Promise.all([loadAnswerReviews(), loadKnowledgeCandidates()]);
      return true;
    } catch (error) {
      console.error('Error resolving senior review:', error);
      triggerToast(getUserFacingError(error, 'Unable to resolve senior review.'));
      await Promise.allSettled([loadAnswerReviews(), loadKnowledgeCandidates()]);
      return false;
    } finally {
      setPendingSeniorReviewIds((current) => current.filter((id) => id !== reviewId));
    }
  };

  const handleApproveCandidate = async (id, reviewNote = 'Approved') => {
    if (pendingCandidateActionIds.includes(id)) return false;
    setPendingCandidateActionIds((current) => [...current, id]);
    triggerToast('Approving suggested AI answer...');
    try {
      const payload = {
        decision: 'APPROVE',
        candidateId: id,
        reviewerId: getCurrentUserId(),
        reviewerRole: normalizeAccountRole(currentUser?.originalRole || currentUser?.role),
        reviewerName: currentUser?.fullName || currentUser?.name || 'Senior Mentor',
        reviewNote,
      };
      if (N8N_ENABLED) {
        try {
          await n8nService.submitSeniorApproval(payload);
          triggerToast('Approved and indexed into AI Tutor knowledge.');
        } catch (n8nErr) {
          if (N8N_STRICT) throw n8nErr;
          console.warn('n8n approval failed, falling back to backend API:', n8nErr);
          await teacherReviewApi.approveCandidate(id, {
            reviewerId: payload.reviewerId,
            reviewerRole: payload.reviewerRole,
            reviewerName: payload.reviewerName,
            reviewNote,
          });
          triggerToast('Approved and indexed into AI Tutor knowledge.');
        }
      } else {
        await teacherReviewApi.approveCandidate(id, {
          reviewerId: payload.reviewerId,
          reviewerRole: payload.reviewerRole,
          reviewerName: payload.reviewerName,
          reviewNote,
        });
        triggerToast('Approved and indexed into AI Tutor knowledge.');
      }
      setCandidates((prev) => prev.filter((candidate) => candidate.id !== id));
      await loadKnowledgeCandidates();
      return true;
    } catch (error) {
      console.error('Error approving candidate:', error);
      triggerToast(getUserFacingError(error, 'Unable to approve suggested AI answer.'));
      await Promise.allSettled([loadKnowledgeCandidates()]);
      return false;
    } finally {
      setPendingCandidateActionIds((current) => current.filter((candidateId) => candidateId !== id));
    }
  };

  const handleRejectCandidate = async (id, rejectionReason = 'Rejected by mentor') => {
    if (pendingCandidateActionIds.includes(id)) return false;
    setPendingCandidateActionIds((current) => [...current, id]);
    triggerToast('Rejecting suggested AI answer...');
    try {
      const payload = {
        decision: 'REJECT',
        candidateId: id,
        reviewerId: getCurrentUserId(),
        reviewerRole: normalizeAccountRole(currentUser?.originalRole || currentUser?.role),
        reviewerName: currentUser?.fullName || currentUser?.name || 'Senior Mentor',
        rejectionReason,
        reviewNote: rejectionReason,
      };
      if (N8N_ENABLED) {
        try {
          await n8nService.submitSeniorApproval(payload);
          triggerToast('Suggested AI answer rejected.');
        } catch (n8nErr) {
          if (N8N_STRICT) throw n8nErr;
          console.warn('n8n reject failed, falling back to backend API:', n8nErr);
          await teacherReviewApi.rejectCandidate(id, {
            reviewerId: payload.reviewerId,
            reviewerRole: payload.reviewerRole,
            reviewerName: payload.reviewerName,
            rejectionReason,
            reviewNote: rejectionReason,
          });
          triggerToast('Suggested AI answer rejected.');
        }
      } else {
        await teacherReviewApi.rejectCandidate(id, {
          reviewerId: payload.reviewerId,
          reviewerRole: payload.reviewerRole,
          reviewerName: payload.reviewerName,
          rejectionReason,
          reviewNote: rejectionReason,
        });
        triggerToast('Suggested AI answer rejected.');
      }
      setCandidates((prev) => prev.filter((candidate) => candidate.id !== id));
      await loadKnowledgeCandidates();
      return true;
    } catch (error) {
      console.error('Error rejecting candidate:', error);
      triggerToast(getUserFacingError(error, 'Unable to reject suggested AI answer.'));
      await Promise.allSettled([loadKnowledgeCandidates()]);
      return false;
    } finally {
      setPendingCandidateActionIds((current) => current.filter((candidateId) => candidateId !== id));
    }
  };

  return {
    classesList,
    teacherStudents,
    teacherTopicHeatmap,
    teacherDashboardLoading,
    teacherSubmissions,
    quizSubmissions,
    setQuizSubmissions,
    selectedTeacherSub,
    setSelectedTeacherSub,
    escalations,
    isTeacherInboxLoading,
    selectedEscalation,
    setSelectedEscalation,
    candidates,
    setCandidates,
    answerReviews,
    seniorAnswerReviews,
    pendingCandidateActionIds,
    pendingSeniorReviewIds,
    loadTeacherSubmissions,
    loadKnowledgeCandidates,
    loadTeacherDashboard,
    loadTeacherInbox,
    loadAnswerReviews,
    handleTeacherQuizReview,
    handleTeacherGradeSubmit,
    handleTeacherAnswerEsc,
    handleMentorReviewAnswer,
    handleSeniorResolveReview,
    handleApproveCandidate,
    handleRejectCandidate,
  };
}
