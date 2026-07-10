import { useState } from 'react';
import { apiService } from '../services/api';
import { getUserFacingError } from '../services/apiClient';

export function useCodeMentorController({
  studentId,
  courseId,
  classId,
  triggerToast,
}) {
  const [codeMentorDiagnostics, setCodeMentorDiagnostics] = useState(null);
  const [isCodeAnalyzing, setIsCodeAnalyzing] = useState(false);

  const handleCodeMentorQuery = async (codeSnippet, codeLanguage, isAssignmentRelated, activeSessionId = null) => {
    setIsCodeAnalyzing(true);
    triggerToast('Analyzing source code...');

    const payload = {
      studentId,
      courseId,
      classId,
      question: 'Analyze this code issue',
      code: codeSnippet,
      language: codeLanguage,
      assignmentRelated: isAssignmentRelated,
      conversationId: activeSessionId || null,
    };

    try {
      const data = await apiService.sendCodeMentorQuery(payload);
      setCodeMentorDiagnostics(data.answer);
      triggerToast('Code analysis completed.');
    } catch (error) {
      console.error('Error analyzing code:', error);
      triggerToast(getUserFacingError(error, 'Unable to analyze code right now.'));
    } finally {
      setIsCodeAnalyzing(false);
    }
  };

  return {
    codeMentorDiagnostics,
    setCodeMentorDiagnostics,
    isCodeAnalyzing,
    handleCodeMentorQuery,
  };
}
