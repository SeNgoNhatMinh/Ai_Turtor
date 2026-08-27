import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAiSnapshot,
  getAssignedMentor,
  getMentorAnswer,
  getQuestionText,
  isAnsweredTicket,
} from '../src/features/student/mentor-review/mentorSupportUtils.js';

test('normalizes support ticket content from backend aliases', () => {
  const ticket = {
    originalQuestion: 'Câu hỏi gốc',
    aiAnswer: 'Câu trả lời AI',
    teacherAnswer: 'Câu trả lời giảng viên',
    teacherName: 'Teacher A',
  };

  assert.equal(getQuestionText(ticket), 'Câu hỏi gốc');
  assert.equal(getAiSnapshot(ticket), 'Câu trả lời AI');
  assert.equal(getMentorAnswer(ticket), 'Câu trả lời giảng viên');
  assert.equal(getAssignedMentor(ticket), 'Teacher A');
});

test('recognizes answered support tickets from content or terminal status', () => {
  assert.equal(isAnsweredTicket({ mentorAnswer: 'Đã trả lời' }), true);
  assert.equal(isAnsweredTicket({ status: 'ANSWERED_PENDING_SENIOR_REVIEW' }), true);
  assert.equal(isAnsweredTicket({ status: 'WAITING_FOR_MENTOR' }), false);
});
