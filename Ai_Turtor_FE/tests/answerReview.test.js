import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FEEDBACK_ACTIONS,
  getAnswerReviewStatus,
  getFeedbackActionKeyForStar,
  getFeedbackRecordedMessage,
} from '../src/constants/answerReview.js';

test('moderate answer dispute routes to mentor-review severity', () => {
  assert.equal(FEEDBACK_ACTIONS.notCorrect.reviewType, 'ANSWER_DISPUTE');
  assert.equal(FEEDBACK_ACTIONS.notCorrect.rating, 2);
  assert.equal(FEEDBACK_ACTIONS.notCorrect.accurate, false);
});

test('serious answer problems route to senior-review severity', () => {
  assert.equal(FEEDBACK_ACTIONS.knowledgeError.rating, 1);
  assert.equal(FEEDBACK_ACTIONS.sourceConflict.reviewType, 'SOURCE_CONFLICT');
  assert.equal(FEEDBACK_ACTIONS.missingMaterial.reviewType, 'MISSING_MATERIAL');
});

test('requesting more detail remains normal quality feedback', () => {
  assert.equal(FEEDBACK_ACTIONS.needMoreDetail.reviewType, 'QUALITY_FEEDBACK');
  assert.equal(FEEDBACK_ACTIONS.needMoreDetail.rating, 4);
});

test('star rating maps to Flow 2 feedback actions', () => {
  assert.equal(getFeedbackActionKeyForStar(5), 'helpful');
  assert.equal(FEEDBACK_ACTIONS[getFeedbackActionKeyForStar(3)].rating, 3);
  assert.equal(FEEDBACK_ACTIONS[getFeedbackActionKeyForStar(1)].rating, 1);
  assert.equal(FEEDBACK_ACTIONS[getFeedbackActionKeyForStar(2)].reviewType, 'ANSWER_DISPUTE');
});

test('review status is read from backend and n8n response envelopes', () => {
  assert.equal(getAnswerReviewStatus({ status: 'NEEDS_MENTOR_REVIEW' }), 'NEEDS_MENTOR_REVIEW');
  assert.equal(getAnswerReviewStatus({ data: { status: 'NEEDS_SENIOR_REVIEW' } }), 'NEEDS_SENIOR_REVIEW');
  assert.match(
    getFeedbackRecordedMessage({ review: { status: 'NEEDS_SENIOR_REVIEW' } }),
    /senior mentor/i,
  );
});
