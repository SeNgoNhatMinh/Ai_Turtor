import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TeacherTranscriptThread from '../../src/features/teacher/tutoring/TeacherTranscriptThread';
import {
  alignBlankValues,
  parseBlankGrades,
  parseWorkSubmission,
} from '../../src/features/teacher/tutoring/practiceEvidence';
import { extractGuidedPractice } from '../../src/features/student/chat/guidedPracticeFill';
import { buildFinishedWorkReviewPrompt } from '../../src/features/student/chat/understandingCheck';

const exerciseAnswer = [
  '## 1. Giải thích',
  'Servlet nhận request GET qua doGet.',
  '',
  '## 2. Bài tập có hướng dẫn',
  'Điền tên phương thức.',
  '```',
  'protected void ____(HttpServletRequest req, HttpServletResponse res) {',
  '  String name = req.____("name");',
  '}',
  '```',
  '',
  '## Kiểm tra hiểu',
  'Câu hỏi: Method nào nhận GET?',
  'A. init()',
  'B. doGet()',
  'C. destroy()',
  'Đáp án: B',
  'Giải thích: doGet xử lý GET.',
].join('\n');

const filled = [
  'protected void doPost(HttpServletRequest req, HttpServletResponse res) {',
  '  String name = req.getParameter("name");',
  '}',
].join('\n');

const submissionPrompt = buildFinishedWorkReviewPrompt({
  draftText: `Mình điền bài tập có hướng dẫn như sau:\n\n\`\`\`\n${filled}\n\`\`\`\n\nNhờ kiểm tra.`,
  incorrectAnswers: [{
    quizIndex: 0,
    quiz: {
      question: 'Method nào nhận GET?',
      options: [{ key: 'A', text: 'init()' }, { key: 'B', text: 'doGet()' }],
      correctKey: 'B',
    },
    selected: { key: 'A', text: 'init()' },
  }],
  originalQuestion: 'Servlet xử lý GET thế nào?',
});

const reviewAnswer = [
  '## 1. Chỗ điền',
  '- Chỗ 1: Chưa đúng. `doPost` xử lý POST, cần `doGet`.',
  '- Chỗ 2: Đúng.',
  '',
  '## 2. Câu trắc nghiệm',
  '- Đáp án đúng là B.',
].join('\n');

describe('practice evidence parsing', () => {
  it('aligns the submitted code with the exercise blanks', () => {
    const practice = extractGuidedPractice(exerciseAnswer);
    expect(alignBlankValues(practice, filled)).toEqual(['doPost', 'getParameter']);
    // The real submission also carries the task sentence written above the code.
    expect(alignBlankValues(practice, `Điền tên phương thức.\n${filled}`)).toEqual(['doPost', 'getParameter']);
  });

  it('reads the AI grade of each blank in order', () => {
    expect(parseBlankGrades(reviewAnswer).map((grade) => grade.correct)).toEqual([false, true]);
  });

  it('reads concept and wrong quiz choices from the hidden submission turn', () => {
    const submission = parseWorkSubmission(submissionPrompt, reviewAnswer);
    expect(submission.concept).toBe('Servlet xử lý GET thế nào?');
    expect(submission.quizMistakes).toEqual([
      { question: 'Method nào nhận GET?', chosen: 'A. init()', correct: 'B. doGet()' },
    ]);
  });
});

describe('teacher transcript practice evidence', () => {
  const messages = [
    { id: 's1', role: 'STUDENT', content: 'Servlet xử lý GET thế nào?' },
    { id: 't1', role: 'AI', content: exerciseAnswer },
    { id: 's2', role: 'STUDENT', content: submissionPrompt },
    { id: 't2', role: 'AI', content: reviewAnswer },
  ];

  it('shows the student filled values with AI grades instead of the hidden prompt', () => {
    render(<TeacherTranscriptThread messages={messages} student={{ fullName: 'An' }} />);

    expect(screen.queryByText(/Hãy sửa bài/)).toBeNull();
    const card = screen.getByLabelText('Bằng chứng bài làm của sinh viên');
    expect(within(card).getByText('Bài tập: 1/2 chỗ đúng')).toBeTruthy();
    expect(within(card).getByText('Quiz: 1 câu sai')).toBeTruthy();
    expect(within(card).getAllByText('doPost').length).toBeGreaterThan(0);

    const exercise = screen.getByLabelText('Bài tập có hướng dẫn');
    expect(within(exercise).getByText('1/2 chỗ đúng')).toBeTruthy();
    expect(within(exercise).getByLabelText(/Chỗ trống 1: doPost \(chưa đúng\)/)).toBeTruthy();
    expect(within(exercise).getByLabelText(/Chỗ trống 2: getParameter \(đúng\)/)).toBeTruthy();
  });
});
