import { useCallback, useState } from 'react';
import { supportApi } from '../services/supportApi';
import { normalizeReviewMode, validateFeedbackText } from '../utils/validators';

export function useAnswerFeedback({ userId, courseId, classId, conversationId }) {
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const submitFeedback = useCallback(async ({ message, rating, feedback }) => {
    if (!userId) throw new Error('Please sign in before submitting feedback.');
    const textValidation = validateFeedbackText(feedback || 'Helpful');
    if (!textValidation.ok) throw new Error(textValidation.message);

    setIsSubmittingFeedback(true);
    try {
      return await supportApi.submitAnswerReview({
        studentId: userId,
        courseId,
        classId,
        conversationId: conversationId || '',
        mode: normalizeReviewMode(message?.mode),
        reviewType: rating === 1 ? 'ANSWER_DISPUTE' : 'QUALITY_FEEDBACK',
        question: message?.question || '',
        answer: message?.answer || '',
        rating,
        accurate: rating === 5,
        helpful: rating === 5,
        correctnessLevel: rating === 5 ? 'HIGH' : 'INCORRECT',
        feedback: textValidation.value,
        suggestedCorrection: rating === 1 ? textValidation.value : undefined,
        reviewedBy: userId,
        reviewerRole: 'STUDENT',
      });
    } finally {
      setIsSubmittingFeedback(false);
    }
  }, [classId, conversationId, courseId, userId]);

  return { submitFeedback, isSubmittingFeedback };
}
