import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import { getUserFacingError } from '../services/apiClient';
import { n8nService } from '../services/n8nService';
import { N8N_ENABLED } from '../services/n8nClient';
import {
  asArray,
  normalizeAnswerReview,
  normalizeTeacherDashboard,
  normalizeTeacherInboxItem,
} from '../services/normalizers';

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
  const [teacherChatInbox, setTeacherChatInbox] = useState([]);
  const [isTeacherInboxLoading, setIsTeacherInboxLoading] = useState(false);
  const [selectedEscalation, setSelectedEscalation] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [answerReviews, setAnswerReviews] = useState([]);
  const [seniorAnswerReviews, setSeniorAnswerReviews] = useState([]);

  const loadTeacherSubmissions = async () => {
    try {
      const data = await apiService.getClassSubmissions(courseId, classId, getTeacherUserId());
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
            apiService.getStudentCourseQuizzes(student.id, courseId)
              .catch(() => ({ quizzes: [] }))
          )
        );
        if (isCancelled) return;
        const aggregated = allQuizzes.flatMap((res, index) => {
          const studentQuizzes = res?.quizzes || [];
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
    setTeacherDashboardLoading(true);
    try {
      const data = await apiService.getTeacherDashboard(getTeacherUserId(), courseId, classId);
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
        const fallback = await apiService.getTeacherClassSections(getTeacherUserId());
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
          const studentsData = await apiService.getClassStudents(courseId, classId);
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
      const data = await apiService.getTeacherEscalationInbox(getTeacherUserId(), { courseId });
      const items = asArray(data, 'escalations', 'inbox', 'content').map(normalizeTeacherInboxItem);
      setEscalations(items);
      setTeacherChatInbox(items.filter((item) => item.chatRoomId && ['assigned', 'active', 'in_chat'].includes(item.status)));
      setSelectedEscalation((current) => current || items[0] || null);
    } catch {
      setEscalations([]);
      setTeacherChatInbox([]);
    } finally {
      setIsTeacherInboxLoading(false);
    }
  };

  const loadAnswerReviews = async () => {
    try {
      const [mentorPending, seniorPending] = await Promise.all([
        apiService.getMentorPendingAnswerReviews(courseId),
        apiService.getSeniorPendingAnswerReviews(courseId),
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
      const data = await apiService.getKnowledgeCandidates('PENDING_REVIEW', courseId);
      setCandidates(asArray(data, 'candidates', 'content'));
    } catch (error) {
      setCandidates([]);
      triggerToast(getUserFacingError(error, 'Unable to load suggested AI answers.'));
    }
  };

  const handleTeacherQuizReview = async (quizSessionId, reviewedScore, feedback) => {
    try {
      await apiService.teacherReviewQuiz(quizSessionId, {
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
      await apiService.gradeSubmission(submissionId, {
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
          console.warn('n8n teacher answer failed, falling back to backend API:', n8nErr);
          await apiService.answerEscalation(escalationId, {
            teacherId: getTeacherUserId(),
            teacherName: currentUser?.fullName || currentUser?.name || 'Teacher',
            answer: reply,
            createKnowledgeCandidate,
            candidateType,
          });
          triggerToast('Answer sent successfully.');
        }
      } else {
        await apiService.answerEscalation(escalationId, {
          teacherId: getTeacherUserId(),
          teacherName: currentUser?.fullName || currentUser?.name || 'Teacher',
          answer: reply,
          createKnowledgeCandidate,
          candidateType,
        });
        triggerToast('Answer sent successfully.');
      }

      setEscalations((prev) => prev.map((item) => (
        item.id === escalationId ? { ...item, status: 'answered' } : item
      )));
      loadTeacherInbox();
    } catch (error) {
      console.error('Error sending answer:', error);
      triggerToast(getUserFacingError(error, 'Unable to send answer. Please try again.'));
    }
  };

  const handleMentorReviewAnswer = async (review, accurate, feedback) => {
    triggerToast('Submitting AI answer review...');
    try {
      await apiService.submitAnswerReview({
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
        reviewerRole: 'MENTOR',
      });
      triggerToast(accurate ? 'Review submitted — AI answer confirmed.' : 'Review submitted — correction noted.');
      loadAnswerReviews();
    } catch (error) {
      console.error('Error submitting mentor review:', error);
      triggerToast(getUserFacingError(error, 'Unable to submit review. Please try again.'));
    }
  };

  const handleSeniorResolveReview = async (reviewId, decision, notes) => {
    triggerToast('Resolving senior review...');
    try {
      await apiService.seniorResolveAnswerReview(reviewId, {
        seniorReviewerId: getTeacherUserId(),
        seniorReviewerName: currentUser?.fullName || currentUser?.name || 'Senior Mentor',
        decision,
        notes,
      });
      triggerToast('Senior review resolved.');
      loadAnswerReviews();
    } catch (error) {
      console.error('Error resolving senior review:', error);
      triggerToast(getUserFacingError(error, 'Unable to resolve senior review.'));
    }
  };

  const handleApproveCandidate = async (id, reviewNote = 'Approved') => {
    triggerToast('Approving suggested AI answer...');
    try {
      const payload = {
        decision: 'APPROVE',
        candidateId: id,
        reviewerId: getCurrentUserId(),
        reviewerRole: activeRole === 'admin' ? 'ADMIN' : 'SENIOR_MENTOR',
        reviewerName: currentUser?.fullName || currentUser?.name || 'Senior Mentor',
        reviewNote,
      };
      if (N8N_ENABLED) {
        try {
          await n8nService.submitSeniorApproval(payload);
          triggerToast('Approved. The answer is ready for AI Tutor knowledge.');
        } catch (n8nErr) {
          console.warn('n8n approval failed, falling back to backend API:', n8nErr);
          await apiService.approveCandidate(id, {
            reviewerId: payload.reviewerId,
            reviewerRole: payload.reviewerRole,
            reviewerName: payload.reviewerName,
            reviewNote,
          });
          triggerToast('Approved. The answer is ready for AI Tutor knowledge.');
        }
      } else {
        await apiService.approveCandidate(id, {
          reviewerId: payload.reviewerId,
          reviewerRole: payload.reviewerRole,
          reviewerName: payload.reviewerName,
          reviewNote,
        });
        triggerToast('Approved. The answer is ready for AI Tutor knowledge.');
      }
      setCandidates((prev) => prev.filter((candidate) => candidate.id !== id));
    } catch (error) {
      console.error('Error approving candidate:', error);
      triggerToast(getUserFacingError(error, 'Unable to approve suggested AI answer.'));
    }
  };

  const handleRejectCandidate = async (id, rejectionReason = 'Rejected by mentor') => {
    triggerToast('Rejecting suggested AI answer...');
    try {
      const payload = {
        decision: 'REJECT',
        candidateId: id,
        reviewerId: getCurrentUserId(),
        reviewerRole: activeRole === 'admin' ? 'ADMIN' : 'SENIOR_MENTOR',
        reviewerName: currentUser?.fullName || currentUser?.name || 'Senior Mentor',
        rejectionReason,
        reviewNote: rejectionReason,
      };
      if (N8N_ENABLED) {
        try {
          await n8nService.submitSeniorApproval(payload);
          triggerToast('Suggested AI answer rejected.');
        } catch (n8nErr) {
          console.warn('n8n reject failed, falling back to backend API:', n8nErr);
          await apiService.rejectCandidate(id, {
            reviewerId: payload.reviewerId,
            reviewerRole: payload.reviewerRole,
            reviewerName: payload.reviewerName,
            rejectionReason,
            reviewNote: rejectionReason,
          });
          triggerToast('Suggested AI answer rejected.');
        }
      } else {
        await apiService.rejectCandidate(id, {
          reviewerId: payload.reviewerId,
          reviewerRole: payload.reviewerRole,
          reviewerName: payload.reviewerName,
          rejectionReason,
          reviewNote: rejectionReason,
        });
        triggerToast('Suggested AI answer rejected.');
      }
      setCandidates((prev) => prev.filter((candidate) => candidate.id !== id));
    } catch (error) {
      console.error('Error rejecting candidate:', error);
      triggerToast(getUserFacingError(error, 'Unable to reject suggested AI answer.'));
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
    teacherChatInbox,
    isTeacherInboxLoading,
    selectedEscalation,
    setSelectedEscalation,
    candidates,
    setCandidates,
    answerReviews,
    seniorAnswerReviews,
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
