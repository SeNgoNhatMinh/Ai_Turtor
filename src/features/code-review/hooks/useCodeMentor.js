import { useState, useCallback } from 'react';
import { apiService } from '../../../services/api';
import { useAuthStore } from '../../../app/store/authStore';
import { useUiStore } from '../../../app/store/uiStore';
import { getUserFacingError } from '../../../services/apiClient';

export function useCodeMentor() {
  const getStudentUserId = useAuthStore(state => state.getStudentUserId);
  const courseId = useUiStore(state => state.courseId);
  const triggerToast = useUiStore(state => state.setToastMessage);

  const [codeMentorDiagnostics, setCodeMentorDiagnostics] = useState(null);
  const [isCodeAnalyzing, setIsCodeAnalyzing] = useState(false);

  const handleCodeMentorQuery = useCallback(async (codeSnippet, codeLanguage, isAssignmentRelated) => {
    setIsCodeAnalyzing(true);
    setCodeMentorDiagnostics(null);
    try {
      const payload = {
        codeSnippet,
        codeLanguage,
        isAssignmentRelated,
        courseId,
        studentId: getStudentUserId()
      };
      const response = await apiService.analyzeCode(payload);
      setCodeMentorDiagnostics(response.analysis || response.answer || response.diagnostics);
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Code analysis failed.'));
      setCodeMentorDiagnostics('An error occurred during code analysis. Please try again later.');
    } finally {
      setIsCodeAnalyzing(false);
    }
  }, [getStudentUserId, courseId, triggerToast]);

  return {
    codeMentorDiagnostics,
    setCodeMentorDiagnostics,
    isCodeAnalyzing,
    handleCodeMentorQuery
  };
}
