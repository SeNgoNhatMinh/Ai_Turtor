import { useState } from 'react';
import { getFeedbackRecordedMessage } from '../../../constants/answerReview';
import { getUserFacingError } from '../../../services/apiClient';
import { N8N_ENABLED, N8N_STRICT } from '../../../services/n8nClient';
import { n8nService } from '../../../services/n8nService';
import { normalizeStudentDashboard, normalizeSuggestions } from '../../../services/normalizers';
import { studentLearningApi } from '../../../services/studentLearningApi';
import { teacherReviewApi } from '../../../services/teacherReviewApi';
import {
  mergeSuggestionLists,
  readAnalyzedSuggestions,
  writeAnalyzedSuggestions,
} from '../../../utils/storage';

const emptyDashboard = {
  learnedTopics: [],
  weakTopics: [],
  pinnedImproveSuggestions: [],
  stats: {},
};

const readCachedSuggestions = (studentId, courseId) => (
  normalizeSuggestions(readAnalyzedSuggestions(studentId, courseId))
);

export function useStudentLearningController({
  studentId,
  courseId,
  classId,
  triggerToast,
}) {
  const [studentDashboard, setStudentDashboard] = useState(emptyDashboard);
  const [suggestions, setSuggestions] = useState([]);

  const loadStudentDashboard = async ({ skipUnauthorizedRedirect = false } = {}) => {
    if (!studentId || !courseId) {
      setStudentDashboard(emptyDashboard);
      setSuggestions([]);
      return;
    }

    try {
      const [data, memorySnapshot] = await Promise.all([
        studentLearningApi.getStudentDashboard(studentId, courseId, { skipUnauthorizedRedirect }),
        studentLearningApi.getStudentMemory(studentId, courseId, { skipUnauthorizedRedirect }).catch((error) => {
          console.warn('Student memory lookup failed while loading dashboard:', error);
          return null;
        }),
      ]);
      const normalized = normalizeStudentDashboard(data);
      const mergedPinnedSuggestions = [
        ...(normalized.pinnedImproveSuggestions || []),
        ...(memorySnapshot?.pinnedImproveSuggestions || []),
      ];
      setStudentDashboard({
        ...normalized,
        learnedTopics: memorySnapshot?.learnedTopics?.length ? memorySnapshot.learnedTopics : normalized.learnedTopics,
        weakTopics: memorySnapshot?.weakTopics?.length ? memorySnapshot.weakTopics : normalized.weakTopics,
        pinnedImproveSuggestions: [...new Set(mergedPinnedSuggestions)],
        summary: memorySnapshot?.summary || normalized.summary || '',
        classId: memorySnapshot?.classId || normalized.classId || classId,
        recentQuestions: memorySnapshot?.recentQuestions || normalized.recentQuestions || [],
        recentAnswers: memorySnapshot?.recentAnswers || normalized.recentAnswers || [],
        updatedAt: memorySnapshot?.updatedAt || normalized.updatedAt || '',
      });
      const mergedSuggestions = mergeSuggestionLists(
        normalized.suggestions || [],
        readCachedSuggestions(studentId, courseId),
      );
      setSuggestions(mergedSuggestions);
      writeAnalyzedSuggestions(studentId, courseId, mergedSuggestions);
    } catch {
      try {
        const memory = await studentLearningApi.getStudentMemory(studentId, courseId, { skipUnauthorizedRedirect });
        const normalizedMemory = normalizeStudentDashboard(memory);
        setStudentDashboard({
          ...emptyDashboard,
          ...normalizedMemory,
          classId: memory.classId || classId,
        });
        const mergedSuggestions = mergeSuggestionLists(
          normalizedMemory.suggestions || [],
          readCachedSuggestions(studentId, courseId),
        );
        setSuggestions(mergedSuggestions);
        writeAnalyzedSuggestions(studentId, courseId, mergedSuggestions);
      } catch {
        setStudentDashboard(emptyDashboard);
        setSuggestions(readCachedSuggestions(studentId, courseId));
      }
    }
  };

  const handleStudentReviewAnswer = async (reviewPayload) => {
    triggerToast('Đang gửi phản hồi...');
    try {
      let response;
      if (N8N_ENABLED) {
        try {
          response = await n8nService.submitAnswerReview(reviewPayload);
        } catch (n8nError) {
          if (N8N_STRICT) throw n8nError;
          console.warn('n8n feedback failed, falling back to backend API:', n8nError);
          response = await teacherReviewApi.submitAnswerReview(reviewPayload);
        }
      } else {
        response = await teacherReviewApi.submitAnswerReview(reviewPayload);
      }
      triggerToast(getFeedbackRecordedMessage(response));
      return response;
    } catch (error) {
      console.error('Error submitting feedback:', error);
      triggerToast(getUserFacingError(error, 'Không thể gửi phản hồi. Vui lòng thử lại.'));
      return null;
    }
  };

  return {
    studentDashboard,
    suggestions,
    loadStudentDashboard,
    handleStudentReviewAnswer,
  };
}
