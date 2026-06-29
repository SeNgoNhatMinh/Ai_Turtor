import { useState, useCallback } from 'react';
import { studentApi } from '../../../services/studentApi';
import { normalizeStudentDashboard, normalizeSuggestions } from '../../../services/normalizers';
import { 
  readPinnedSuggestions, 
  readAnalyzedSuggestions, 
  mergeSuggestionLists,
  writeAnalyzedSuggestions,
} from '../../../utils/storage';
import { useAuthStore } from '../../../app/store/authStore';
import { useUiStore } from '../../../app/store/uiStore';
import { getUserFacingError } from '../../../services/apiClient';

export function useStudentDashboard() {
  const getStudentUserId = useAuthStore(state => state.getStudentUserId);
  const courseId = useUiStore(state => state.courseId);
  const classId = useUiStore(state => state.classId);
  const triggerToast = useUiStore(state => state.setToastMessage);
  
  const [studentDashboard, setStudentDashboard] = useState({ learnedTopics: [], weakTopics: [], stats: {} });
  const [isStudentDashboardLoading, setIsStudentDashboardLoading] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  const loadStudentDashboard = useCallback(async () => {
    setIsStudentDashboardLoading(true);
    const studentId = getStudentUserId();
    const localPinnedSuggestions = readPinnedSuggestions(studentId, courseId);
    const cachedAnalyzedSuggestions = readAnalyzedSuggestions(studentId, courseId);
    
    try {
      const data = await studentApi.getStudentDashboard(studentId, courseId);
      const normalized = normalizeStudentDashboard(data);
      let memorySnapshot = null;
      try {
        memorySnapshot = await studentApi.getStudentMemory(studentId, courseId);
      } catch (memoryError) {
        console.warn('Student memory lookup failed while loading dashboard:', memoryError);
      }
      
      const mergedPinnedSuggestions = [
        ...(normalized.pinnedImproveSuggestions || []),
        ...(memorySnapshot?.pinnedImproveSuggestions || []),
        ...localPinnedSuggestions,
      ];
      
      setStudentDashboard({
        ...normalized,
        learnedTopics: memorySnapshot?.learnedTopics?.length ? memorySnapshot.learnedTopics : normalized.learnedTopics,
        weakTopics: memorySnapshot?.weakTopics?.length ? memorySnapshot.weakTopics : normalized.weakTopics,
        pinnedImproveSuggestions: [...new Set(mergedPinnedSuggestions)],
      });
      
      if (cachedAnalyzedSuggestions.length || normalized.suggestions?.length) {
        setSuggestions((prev) => mergeSuggestionLists(cachedAnalyzedSuggestions, normalized.suggestions || [], prev));
      }
    } catch (e) {
      try {
        const memory = await studentApi.getStudentMemory(studentId, courseId);
        const mergedPinnedSuggestions = [
          ...(memory.pinnedImproveSuggestions || []),
          ...localPinnedSuggestions,
        ];
        setStudentDashboard({
          learnedTopics: memory.learnedTopics || [],
          weakTopics: memory.weakTopics || [],
          pinnedImproveSuggestions: [...new Set(mergedPinnedSuggestions)],
          stats: {},
        });
        if (cachedAnalyzedSuggestions.length || memory.improveSuggestions?.length) {
          setSuggestions((prev) => mergeSuggestionLists(cachedAnalyzedSuggestions, memory.improveSuggestions || [], prev));
        }
      } catch {
        setStudentDashboard({ learnedTopics: [], weakTopics: [], pinnedImproveSuggestions: localPinnedSuggestions, stats: {} });
        if (cachedAnalyzedSuggestions.length) {
          setSuggestions((prev) => mergeSuggestionLists(cachedAnalyzedSuggestions, prev));
        }
      }
    } finally {
      setIsStudentDashboardLoading(false);
    }
  }, [getStudentUserId, courseId]);

  const refreshSuggestions = useCallback(async () => {
    const studentId = getStudentUserId();
    if (!studentId || !courseId) {
      triggerToast('Please choose a course before analyzing suggestions.');
      return;
    }
    setIsSuggesting(true);
    try {
      const data = await studentApi.getSuggestions(studentId, courseId, {
        classId,
        requesterUserId: studentId,
        includeAiSuggestion: true,
      });
      const normalized = normalizeSuggestions(data);
      const nextSuggestions = mergeSuggestionLists(normalized, suggestions);
      setSuggestions(nextSuggestions);
      writeAnalyzedSuggestions(studentId, courseId, nextSuggestions);
      triggerToast('Learning suggestions updated.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Unable to refresh learning suggestions.'));
    } finally {
      setIsSuggesting(false);
    }
  }, [getStudentUserId, courseId, classId, suggestions, triggerToast]);

  return {
    studentDashboard,
    isStudentDashboardLoading,
    isSuggesting,
    suggestions,
    loadStudentDashboard,
    refreshSuggestions,
  };
}
