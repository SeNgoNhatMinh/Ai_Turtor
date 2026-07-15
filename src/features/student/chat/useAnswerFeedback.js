import { useCallback, useState } from 'react';
import { FEEDBACK_ACTIONS, getFeedbackAction } from '../../../constants/answerReview';
import { normalizeReviewMode, validateFeedbackText } from '../../../utils/validators';

export function useAnswerFeedback({
  activeSessionId,
  classId,
  courseId,
  onSubmitReview,
  triggerToast,
  userId,
}) {
  const [feedbackOpenIndex, setFeedbackOpenIndex] = useState(null);
  const [feedbackAction, setFeedbackAction] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);

  const closeFeedbackForm = useCallback(() => {
    setFeedbackOpenIndex(null);
    setFeedbackAction(null);
    setFeedbackText('');
  }, []);

  const openFeedbackForm = useCallback((index, actionKey) => {
    setFeedbackOpenIndex(index);
    setFeedbackAction(getFeedbackAction(actionKey));
    setFeedbackText('');
  }, []);

  const buildPayload = useCallback((message, actionConfig, feedback) => {
    if (!userId) return { ok: false, message: 'Please sign in before sending feedback.' };
    if (!courseId || !classId) return { ok: false, message: 'Please select your enrolled course first.' };
    if (!message?.answer) return { ok: false, message: 'There is no AI answer to review.' };

    const action = actionConfig || FEEDBACK_ACTIONS.needMoreDetail;
    const cleanedFeedback = String(feedback || action.defaultFeedback || action.label).trim();
    return {
      ok: true,
      value: {
        studentId: userId,
        courseId,
        classId,
        conversationId: activeSessionId || '',
        mode: normalizeReviewMode(message?.mode),
        reviewType: action.reviewType,
        question: message.question || '',
        answer: message.answer || '',
        rating: action.rating,
        accurate: action.accurate,
        helpful: action.helpful,
        correctnessLevel: action.correctnessLevel,
        feedback: cleanedFeedback,
        suggestedCorrection: action.reviewType === 'ANSWER_DISPUTE' ? cleanedFeedback : undefined,
        reviewedBy: userId,
        reviewerRole: 'STUDENT',
      },
    };
  }, [activeSessionId, classId, courseId, userId]);

  const submitQuickReview = useCallback(async (message, actionKey) => {
    if (!onSubmitReview || isFeedbackSubmitting) return;
    const action = FEEDBACK_ACTIONS[actionKey] || FEEDBACK_ACTIONS.helpful;
    const payload = buildPayload(message, action, action.defaultFeedback);
    if (!payload.ok) {
      triggerToast?.(payload.message);
      return;
    }
    setIsFeedbackSubmitting(true);
    try {
      await onSubmitReview(payload.value);
    } finally {
      setIsFeedbackSubmitting(false);
    }
  }, [buildPayload, isFeedbackSubmitting, onSubmitReview, triggerToast]);

  const submitFeedback = useCallback(async (message) => {
    if (!onSubmitReview || isFeedbackSubmitting) return;
    const textValidation = validateFeedbackText(feedbackText);
    if (!textValidation.ok) {
      triggerToast?.(textValidation.message);
      return;
    }
    const payload = buildPayload(
      message,
      feedbackAction || FEEDBACK_ACTIONS.needMoreDetail,
      textValidation.value,
    );
    if (!payload.ok) {
      triggerToast?.(payload.message);
      return;
    }
    setIsFeedbackSubmitting(true);
    try {
      await onSubmitReview(payload.value);
      closeFeedbackForm();
    } finally {
      setIsFeedbackSubmitting(false);
    }
  }, [buildPayload, closeFeedbackForm, feedbackAction, feedbackText, isFeedbackSubmitting, onSubmitReview, triggerToast]);

  return {
    closeFeedbackForm,
    feedbackAction,
    feedbackOpenIndex,
    feedbackText,
    isFeedbackSubmitting,
    openFeedbackForm,
    setFeedbackText,
    submitFeedback,
    submitQuickReview,
  };
}
