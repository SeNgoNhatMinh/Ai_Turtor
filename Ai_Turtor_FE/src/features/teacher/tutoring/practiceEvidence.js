/**
 * Turns the hidden "Học sinh đã nộp cả bài tập có hướng dẫn và quiz" turn and the AI review that
 * follows it into evidence a teacher can read: what the student wrote in each blank, which quiz
 * choices were wrong, and how the AI graded each blank.
 */
import { extractGuidedPractice } from '../../student/chat/guidedPracticeFill';
import { isFinishedWorkReviewQuestion } from '../../student/chat/understandingCheck';

const FENCE = /```[^\n]*\n([\s\S]*?)```/;
const QUESTION_LINE = /^(?:-\s*)?Câu(?:\s+vừa\s+làm|\s+\d+)?\s*:\s*(.+)$/i;
const CHOSEN_LINE = /^(?:Em|Học sinh)?\s*đã chọn\s*:\s*(.+)$/i;
const CORRECT_LINE = /^Đáp án đúng\s*:\s*(.+)$/i;
const ALL_CORRECT = /(?:các câu trắc nghiệm đều đúng|quiz và các câu trắc nghiệm đều đúng)/i;
const HEADING = /^#{1,6}\s+(?:\d+\.\s*)?(.+?)\s*$/;

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Code the student submitted (first fenced block), or ''. */
export function submittedPracticeCode(question) {
  const match = String(question || '').match(FENCE);
  return match ? match[1].replace(/\n$/, '') : '';
}

export function parseQuizMistakes(question) {
  const mistakes = [];
  let current = null;
  for (const raw of String(question || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const q = line.match(QUESTION_LINE);
    if (q) {
      current = { question: q[1].trim(), chosen: '', correct: '' };
      mistakes.push(current);
      continue;
    }
    if (!current) continue;
    const chosen = line.match(CHOSEN_LINE);
    if (chosen) {
      current.chosen = chosen[1].trim();
      continue;
    }
    const correct = line.match(CORRECT_LINE);
    if (correct) current.correct = correct[1].trim();
  }
  return mistakes.filter((item) => item.chosen);
}

/**
 * Ordered grades from the review's "Chỗ điền" section: [{ correct, note }].
 * Only bullets that clearly say Đúng / Chưa đúng count.
 */
export function parseBlankGrades(reviewAnswer) {
  const lines = String(reviewAnswer || '').split(/\r?\n/);
  const start = lines.findIndex((line) => {
    const heading = line.trim().match(HEADING);
    return heading && /chỗ điền/i.test(heading[1]);
  });
  if (start < 0) return [];
  const grades = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (HEADING.test(line)) break;
    const bullet = line.match(/^(?:[-*+]|\d+[.)])\s+(.+)$/);
    if (!bullet) continue;
    const text = bullet[1].replace(/\*\*/g, '').trim();
    if (/chưa\s+đúng|\bsai\b/i.test(text)) grades.push({ correct: false, note: text });
    else if (/đúng/i.test(text)) grades.push({ correct: true, note: text });
  }
  return grades;
}

/** What the student typed in each blank of the exercise template, or null when it cannot be aligned. */
export function alignBlankValues(practice, filledCode) {
  const segments = Array.isArray(practice?.segments) ? practice.segments : [];
  const blanks = segments.filter((segment) => segment.type === 'blank').length;
  if (!blanks || !filledCode) return null;
  const text = String(filledCode).trim();
  const build = (loose) => segments.map((segment, index) => {
    if (segment.type === 'blank') return '([^\\n]*?)';
    let piece = segment.text;
    // Loose mode: the task sentence above / notes below the code may differ from the template.
    if (loose && index === 0) piece = piece.slice(piece.lastIndexOf('\n') + 1);
    if (loose && index === segments.length - 1 && piece.includes('\n')) piece = piece.slice(0, piece.indexOf('\n'));
    return escapeRegExp(piece).replace(/\s+/g, '\\s*');
  }).join('');
  const strict = text.match(new RegExp(`^\\s*${build(false)}\\s*$`));
  const match = strict || text.match(new RegExp(build(true)));
  return match ? match.slice(1).map((value) => value.trim()) : null;
}

export function parseWorkSubmission(question, reviewAnswer = '') {
  if (!isFinishedWorkReviewQuestion(question)) return null;
  const text = String(question || '');
  const concept = (text.match(/^Concept học sinh đã hỏi:\s*(.+)$/im) || [])[1]?.trim() || '';
  const mistakes = parseQuizMistakes(text);
  return {
    concept,
    code: submittedPracticeCode(text),
    quizMistakes: mistakes,
    quizAllCorrect: !mistakes.length && ALL_CORRECT.test(text),
    grades: parseBlankGrades(reviewAnswer),
  };
}

/**
 * Pairs every exercise answer turn with the student's later submission.
 * byExercise: exercise turn id -> { values, grades } (values null when not aligned)
 * bySubmission: submission turn id -> { submission, values }
 */
export function practiceEvidenceByTurn(turns, textOf) {
  const byExercise = new Map();
  const bySubmission = new Map();
  let pendingExercise = null;
  (Array.isArray(turns) ? turns : []).forEach((turn) => {
    const question = textOf(turn.student);
    const answer = textOf(turn.tutor);
    const submission = parseWorkSubmission(question, answer);
    if (submission) {
      const values = pendingExercise ? alignBlankValues(pendingExercise.practice, submission.code) : null;
      if (pendingExercise) byExercise.set(pendingExercise.id, { values, grades: submission.grades });
      bySubmission.set(turn.id, { submission, values });
      pendingExercise = null;
      return;
    }
    const practice = answer ? extractGuidedPractice(answer) : null;
    if (practice) pendingExercise = { id: turn.id, practice };
  });
  return { byExercise, bySubmission };
}
