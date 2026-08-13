import { useCallback, useState } from 'react';
import {
  FEEDBACK_ACTIONS,
  getFeedbackAction,
  getFeedbackActionKeyForStar,
} from '../../../constants/answerReview';
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
  const [feedbackPanelMode, setFeedbackPanelMode] = useState(null);
  const [feedbackAction, setFeedbackAction] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);

  const closeFeedbackForm = useCallback(() => {
    setFeedbackOpenIndex(null);
    setFeedbackPanelMode(null);
    setFeedbackAction(null);
    setFeedbackText('');
  }, []);

  const openRatingPanel = useCallback((index) => {
    setFeedbackOpenIndex(index);
    setFeedbackPanelMode('stars');
    setFeedbackAction(null);
    setFeedbackText('');
  }, []);

  const toggleRatingPanel = useCallback((index) => {
    if (feedbackOpenIndex === index && feedbackPanelMode === 'stars') {
      closeFeedbackForm();
      return;
    }
    openRatingPanel(index);
  }, [closeFeedbackForm, feedbackOpenIndex, feedbackPanelMode, openRatingPanel]);

  const openFeedbackForm = useCallback((index, actionKey) => {
    setFeedbackOpenIndex(index);
    setFeedbackPanelMode('form');
    setFeedbackAction(getFeedbackAction(actionKey));
    setFeedbackText('');
  }, []);

  const buildPayload = useCallback((message, actionConfig, feedback) => {
    if (!userId) return { ok: false, message: 'Vui lòng đăng nhập trước khi gửi góp ý.' };
    if (!courseId || !classId) return { ok: false, message: 'Hãy chọn môn học đã ghi danh trước.' };
    if (!message?.answer) return { ok: false, message: 'Không có câu trả lời AI để đánh giá.' };

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
      closeFeedbackForm();
    } finally {
      setIsFeedbackSubmitting(false);
    }
  }, [buildPayload, closeFeedbackForm, isFeedbackSubmitting, onSubmitReview, triggerToast]);

  const selectStarRating = useCallback(async (message, index, star) => {
    if (isFeedbackSubmitting) return;
    const actionKey = getFeedbackActionKeyForStar(star);
    if (star === 5) {
      await submitQuickReview(message, actionKey);
      return;
    }
    openFeedbackForm(index, actionKey);
  }, [isFeedbackSubmitting, openFeedbackForm, submitQuickReview]);

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
    feedbackPanelMode,
    feedbackText,
    isFeedbackSubmitting,
    openFeedbackForm,
    openRatingPanel,
    selectStarRating,
    setFeedbackText,
    submitFeedback,
    submitQuickReview,
    toggleRatingPanel,
  };
}
