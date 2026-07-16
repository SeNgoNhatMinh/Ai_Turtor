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
  suggestionMatchesText,
  writeAnalyzedSuggestions,
  mergeSuggestionLists,
} from '../../../utils/storage';

const createStudyTipSuggestion = (text) => ({
  priority: 'high',
  title: String(text || '').trim(),
  content: 'Created from the study note you selected in AI Tutor Chat. Review it first, then use Study now or Create quiz when you are ready.',
  source: 'CHAT_STUDY_TIP',
});

const isSuggestionServiceFailure = (suggestion) => {
  const value = `${suggestion?.title || ''} ${suggestion?.content || ''}`.toLowerCase();
  return value.includes('ai suggestion failed') || value.includes('llm') || value.includes('dịch vụ llm');
};

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
      const localSuggestions = readAnalyzedSuggestions(studentId, courseId);
      const mergedSuggestions = mergeSuggestionLists(localSuggestions, normalized.suggestions || []);

      if (mergedSuggestions.length) {
        setSuggestions(mergedSuggestions);
        writeAnalyzedSuggestions(studentId, courseId, mergedSuggestions);
      }
    } catch {
      try {
        const memory = await studentLearningApi.getStudentMemory(studentId, courseId);
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
      } catch {
        setStudentDashboard(emptyDashboard);
      }
    } finally {
      setIsStudentDashboardLoading(false);
    }
  };

  const refreshSuggestions = async (question = '') => {
    const questionText = String(question || '').trim();
    setIsSuggesting(true);
    triggerToast(questionText ? 'AI is analyzing this study tip...' : 'AI is analyzing your learning memory...');

    try {
      const data = await studentLearningApi.getSuggestions(studentId, courseId, {
        classId,
        question: questionText || undefined,
        includeAiSuggestion: Boolean(questionText),
      });
      const normalized = normalizeSuggestions(data).filter((item) => !isSuggestionServiceFailure(item));
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
      triggerToast(questionText ? 'Study tip added to Learning Progress.' : 'Study plan analysis completed.');
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      triggerToast(getUserFacingError(error, 'Unable to analyze learning suggestions.'));
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleStudentUpdateMemory = async (learnedList, weakList) => {
    triggerToast('Updating learning profiler...');
    try {
      const payload = {
        classId,
        learnedTopics: learnedList,
        weakTopics: weakList,
        summary: `Manually updated concepts: ${learnedList.join(', ')}. Focus areas: ${weakList.join(', ')}.`,
      };
      await studentLearningApi.updateStudentMemory(studentId, courseId, payload);
      triggerToast('Profiler updated successfully.');
      loadStudentDashboard();
    } catch (error) {
      console.error('Error updating memory:', error);
      triggerToast(getUserFacingError(error, 'Unable to update learning profiler.'));
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
      triggerToast('Suggestion pinned.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to pin suggestion.'));
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
      triggerToast('Suggestion unpinned.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to unpin suggestion.'));
    }
  };

  const handleStudentReviewAnswer = async (reviewPayload) => {
    triggerToast('Submitting your feedback...');
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
      triggerToast(getUserFacingError(error, 'Unable to submit feedback. Please try again.'));
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
    handleStudentReviewAnswer,
  };
}
