import { useCallback } from 'react';
import { apiService } from '../../../services/api';
import { useAuthStore } from '../../../app/store/authStore';
import { useUiStore } from '../../../app/store/uiStore';
import { getUserFacingError } from '../../../services/apiClient';

export function useSuggestions() {
  const getStudentUserId = useAuthStore(state => state.getStudentUserId);
  const triggerToast = useUiStore(state => state.setToastMessage);

  const handleStudentUpdateMemory = useCallback(async (learnedList, weakList) => {
    try {
      await apiService.updateStudentMemory(getStudentUserId(), learnedList, weakList);
      triggerToast('Memory updated.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Failed to update memory.'));
    }
  }, [getStudentUserId, triggerToast]);

  const handlePinImproveSuggestion = useCallback(async (suggestion) => {
    try {
      await apiService.pinImproveSuggestion(getStudentUserId(), suggestion.title || suggestion.content);
      triggerToast('Suggestion pinned.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Failed to pin suggestion.'));
    }
  }, [getStudentUserId, triggerToast]);

  const handleUnpinImproveSuggestion = useCallback(async (suggestion) => {
    try {
      await apiService.unpinImproveSuggestion(getStudentUserId(), suggestion.title || suggestion.content);
      triggerToast('Suggestion unpinned.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Failed to unpin suggestion.'));
    }
  }, [getStudentUserId, triggerToast]);

  const handleStudentReviewAnswer = useCallback(async (reviewPayload) => {
    try {
      await apiService.reviewAnswer(reviewPayload);
      triggerToast('Review submitted.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Review failed.'));
    }
  }, [triggerToast]);

  const handleMentorReviewAnswer = useCallback(async (review, accurate, feedback) => {
    try {
      await apiService.mentorReviewAnswer(review.id, getStudentUserId(), accurate, feedback);
      triggerToast('Mentor review submitted.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Mentor review failed.'));
    }
  }, [getStudentUserId, triggerToast]);

  const handleSeniorResolveReview = useCallback(async (reviewId, decision, notes) => {
    try {
      await apiService.seniorResolveReview(reviewId, getStudentUserId(), decision, notes);
      triggerToast('Review resolved.');
    } catch (error) {
      triggerToast(getUserFacingError(error, 'Resolve failed.'));
    }
  }, [getStudentUserId, triggerToast]);

  return {
    handleStudentUpdateMemory,
    handlePinImproveSuggestion,
    handleUnpinImproveSuggestion,
    handleStudentReviewAnswer,
    handleMentorReviewAnswer,
    handleSeniorResolveReview
  };
}
