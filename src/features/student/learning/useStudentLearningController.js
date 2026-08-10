import { useState } from 'react';
import { getUserFacingError } from '../../../services/apiClient';
import { studentLearningApi } from '../../../services/studentLearningApi';
import { teacherReviewApi } from '../../../services/teacherReviewApi';
import { normalizeStudentDashboard, normalizeSuggestions } from '../../../services/normalizers';
import { n8nService } from '../../../services/n8nService';
import { N8N_ENABLED, N8N_STRICT } from '../../../services/n8nClient';
import { getFeedbackRecordedMessage } from '../../../constants/answerReview';
import {
  createRecoveredSuggestion,
  readAnalyzedSuggestions,
  removeAnalyzedSuggestion,
  suggestionMatchesText,
  writeAnalyzedSuggestions,
  mergeSuggestionLists,
} from '../../../utils/storage';

const createStudyTipSuggestion = (text) => ({
  priority: 'high',
  title: String(text || '').trim(),
  content: 'Created from the study note you selected in AI Tutor Chat. Review it first, then use Study now or Create quiz when you are ready.',
  source: 'CHAT_STUDY_TIP',
  persistence: 'LOCAL_ANALYSIS',
  deletable: true,
});

const isSuggestionServiceFailure = (suggestion) => {
  const value = `${suggestion?.title || ''} ${suggestion?.content || ''}`.toLowerCase();
  return value.includes('ai suggestion failed') || value.includes('llm') || value.includes('dịch vụ llm');
};

const normalizeCachedSuggestions = (studentId, courseId) => (
  normalizeSuggestions(readAnalyzedSuggestions(studentId, courseId)).map((item) => {
    if (item.persistence) return item;
    return {
      ...item,
      persistence: 'LOCAL_ANALYSIS',
      deletable: item.kind !== 'note' && String(item.source || '').toUpperCase() !== 'RULE',
    };
  })
);

const emptyDashboard = { learnedTopics: [], weakTopics: [], pinnedImproveSuggestions: [], stats: {} };

export function useStudentLearningController({
  studentId,
  courseId,
  classId,
  switchTab,
  triggerToast,
}) {
  const [studentDashboard, setStudentDashboard] = useState(emptyDashboard);
  const [isStudentDashboardLoading, setIsStudentDashboardLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const loadStudentDashboard = async () => {
    if (!studentId || !courseId) {
      setStudentDashboard(emptyDashboard);
      setSuggestions([]);
      return;
    }

    setIsStudentDashboardLoading(true);
    try {
      const data = await studentLearningApi.getStudentDashboard(studentId, courseId);
      const normalized = normalizeStudentDashboard(data);
      let memorySnapshot = null;
      try {
        memorySnapshot = await studentLearningApi.getStudentMemory(studentId, courseId);
      } catch (memoryError) {
        console.warn('Student memory lookup failed while loading dashboard:', memoryError);
      }
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
      const localSuggestions = normalizeCachedSuggestions(studentId, courseId);
      // Canonical backend items come first so their delete metadata is not
      // overwritten by an older browser cache entry with the same title.
      const mergedSuggestions = mergeSuggestionLists(normalized.suggestions || [], localSuggestions);
      setSuggestions(mergedSuggestions);
      writeAnalyzedSuggestions(studentId, courseId, mergedSuggestions);
    } catch {
      try {
        const memory = await studentLearningApi.getStudentMemory(studentId, courseId);
        const normalizedMemory = normalizeStudentDashboard(memory);
        setStudentDashboard({
          learnedTopics: memory.learnedTopics || [],
          weakTopics: memory.weakTopics || [],
          pinnedImproveSuggestions: [...new Set(memory.pinnedImproveSuggestions || [])],
          summary: memory.summary || '',
          classId: memory.classId || classId,
          recentQuestions: memory.recentQuestions || [],
          recentAnswers: memory.recentAnswers || [],
          updatedAt: memory.updatedAt || '',
          stats: {},
        });
        const mergedSuggestions = mergeSuggestionLists(
          normalizedMemory.suggestions || [],
          normalizeCachedSuggestions(studentId, courseId),
        );
        setSuggestions(mergedSuggestions);
        writeAnalyzedSuggestions(studentId, courseId, mergedSuggestions);
      } catch {
        setStudentDashboard(emptyDashboard);
        setSuggestions(normalizeCachedSuggestions(studentId, courseId));
      }
    } finally {
      setIsStudentDashboardLoading(false);
    }
  };

  const refreshSuggestions = async (question = '') => {
    const questionText = String(question || '').trim();
    setIsSuggesting(true);
    triggerToast(questionText ? 'AI đang phân tích lưu ý học tập này...' : 'AI đang phân tích bộ nhớ học tập...');

    try {
      const data = await studentLearningApi.getSuggestions(studentId, courseId, {
        classId,
        question: questionText || undefined,
        includeAiSuggestion: Boolean(questionText),
      });
      const normalized = normalizeSuggestions(data)
        .filter((item) => !isSuggestionServiceFailure(item))
        .map((item) => ({
          ...item,
          persistence: 'LOCAL_ANALYSIS',
          deletable: item.kind !== 'note' && String(item.source || '').toUpperCase() !== 'RULE',
        }));
      const focusedSuggestion = questionText ? createStudyTipSuggestion(questionText) : null;
      const finalSuggestions = mergeSuggestionLists(
        focusedSuggestion ? [focusedSuggestion] : [],
        normalized,
        suggestions,
      );
      setSuggestions(finalSuggestions);
      writeAnalyzedSuggestions(studentId, courseId, finalSuggestions);
      if (questionText) {
        switchTab('student-memory');
        loadStudentDashboard();
      }
      triggerToast(questionText ? 'Đã thêm lưu ý vào Tiến độ học tập.' : 'Đã hoàn tất phân tích kế hoạch học tập.');
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      triggerToast(getUserFacingError(error, 'Không thể phân tích gợi ý học tập.'));
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleStudentUpdateMemory = async (learnedList, weakList) => {
    triggerToast('Đang cập nhật hồ sơ học tập...');
    try {
      const payload = {
        classId,
        learnedTopics: learnedList,
        weakTopics: weakList,
        summary: `Nội dung cập nhật thủ công: ${learnedList.join(', ')}. Nội dung cần tập trung: ${weakList.join(', ')}.`,
      };
      await studentLearningApi.updateStudentMemory(studentId, courseId, payload);
      triggerToast('Đã cập nhật hồ sơ học tập.');
      loadStudentDashboard();
    } catch (error) {
      console.error('Error updating memory:', error);
      triggerToast(getUserFacingError(error, 'Không thể cập nhật hồ sơ học tập.'));
    }
  };

  const handlePinImproveSuggestion = async (suggestion) => {
    try {
      const memory = await studentLearningApi.pinImproveSuggestion(studentId, courseId, suggestion);
      const fallbackPinnedSuggestions = [
        ...new Set([...(studentDashboard?.pinnedImproveSuggestions || []), suggestion]),
      ];
      const nextPinnedSuggestions = memory?.pinnedImproveSuggestions?.length
        ? memory.pinnedImproveSuggestions
        : fallbackPinnedSuggestions;
      setStudentDashboard((prev) => ({
        ...prev,
        learnedTopics: memory?.learnedTopics || prev?.learnedTopics || [],
        weakTopics: memory?.weakTopics || prev?.weakTopics || [],
        pinnedImproveSuggestions: nextPinnedSuggestions,
      }));
      triggerToast('Đã ghim gợi ý.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể ghim gợi ý.'));
    }
  };

  const handleUnpinImproveSuggestion = async (suggestion) => {
    try {
      const memory = await studentLearningApi.unpinImproveSuggestion(studentId, courseId, suggestion);
      const fallbackPinnedSuggestions = (studentDashboard?.pinnedImproveSuggestions || []).filter(
        (item) => String(item).toLowerCase() !== String(suggestion).toLowerCase(),
      );
      const nextPinnedSuggestions = Array.isArray(memory?.pinnedImproveSuggestions)
        ? memory.pinnedImproveSuggestions
        : fallbackPinnedSuggestions;
      setStudentDashboard((prev) => ({
        ...prev,
        learnedTopics: memory?.learnedTopics || prev?.learnedTopics || [],
        weakTopics: memory?.weakTopics || prev?.weakTopics || [],
        pinnedImproveSuggestions: nextPinnedSuggestions,
      }));
      setSuggestions((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        if (list.some((item) => suggestionMatchesText(item, suggestion))) {
          return list;
        }
        return [createRecoveredSuggestion(suggestion), ...list];
      });
      triggerToast('Đã bỏ ghim gợi ý.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể bỏ ghim gợi ý.'));
    }
  };

  const handleDeleteImproveSuggestion = async (suggestion) => {
    try {
      const displayText = String(suggestion?.actionText || suggestion?.title || suggestion?.content || suggestion || '').trim();
      const deleteValue = String(suggestion?.deleteValue || displayText).trim();
      const shouldDeleteFromBackend = suggestion?.persistence !== 'LOCAL_ANALYSIS';
      const response = shouldDeleteFromBackend
        ? await studentLearningApi.deleteImproveSuggestion(studentId, courseId, deleteValue)
        : null;

      if (shouldDeleteFromBackend && Array.isArray(response?.improveSuggestions)) {
        const stillExists = response.improveSuggestions.some(
          (item) => String(item).trim().toLowerCase() === deleteValue.toLowerCase(),
        );
        if (stillExists) {
          throw new Error('Backend did not remove the requested suggestion.');
        }
      }

      // Update dashboard pinned list conservatively from response or local fallback
      const nextPinnedSuggestions = Array.isArray(response?.pinnedImproveSuggestions)
        ? response.pinnedImproveSuggestions
        : (studentDashboard?.pinnedImproveSuggestions || []).filter(
          (item) => String(item).trim().toLowerCase() !== displayText.toLowerCase(),
        );
      setStudentDashboard((prev) => ({
        ...prev,
        pinnedImproveSuggestions: nextPinnedSuggestions,
      }));
      removeAnalyzedSuggestion(studentId, courseId, suggestion);
      setSuggestions((prev) => {
        const next = Array.isArray(prev)
          ? prev.filter((item) => !suggestionMatchesText(item, suggestion))
          : [];
        writeAnalyzedSuggestions(studentId, courseId, next);
        return next;
      });
      triggerToast('Đã xóa gợi ý.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Không thể xóa gợi ý.'));
    }
  };

  const handleStudentReviewAnswer = async (reviewPayload) => {
    triggerToast('Đang gửi phản hồi...');
    try {
      let response;
      if (N8N_ENABLED) {
        try {
          response = await n8nService.submitAnswerReview(reviewPayload);
        } catch (n8nErr) {
          if (N8N_STRICT) throw n8nErr;
          console.warn('n8n feedback failed, falling back to backend API:', n8nErr);
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
    isStudentDashboardLoading,
    suggestions,
    isSuggesting,
    loadStudentDashboard,
    refreshSuggestions,
    handleStudentUpdateMemory,
    handlePinImproveSuggestion,
    handleUnpinImproveSuggestion,
    handleDeleteImproveSuggestion,
    handleStudentReviewAnswer,
  };
}
