import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildClassStudentRows,
  formatTeacherStudentLabel,
  groupRowsByClass,
  groupTranscriptTurns,
  groupTutorSummariesByStudent,
  isShortStudyTopic,
  mergeRosterIdentity,
  sessionHeadline,
  studentInitials,
  supportLevelLabel,
  uniqueClassScopes,
} from '../src/features/teacher/tutoring/teacherTutoringStudents.js';

test('teacher student labels prefer name and student code over UUID', () => {
  assert.equal(
    formatTeacherStudentLabel({
      studentId: '7bd7d121-b1b4-4b47-b077-a1d617a98219',
      studentName: 'Nguyen Van A',
      studentCode: 'SE1840001',
    }),
    'Nguyen Van A · SE1840001',
  );
  assert.equal(
    formatTeacherStudentLabel({
      studentId: '7bd7d121-b1b4-4b47-b077-a1d617a98219',
    }),
    'Sinh viên',
  );
  assert.equal(studentInitials({ studentName: 'Nguyen Van A' }), 'NA');
});

test('merges class roster identity onto a tutor summary UUID', () => {
  const merged = mergeRosterIdentity(
    {
      id: 'summary-1',
      studentId: '7bd7d121-b1b4-4b47-b077-a1d617a98219',
      topic: 'Cache',
    },
    [{
      studentId: '7bd7d121-b1b4-4b47-b077-a1d617a98219',
      studentName: 'Nguyen Van A',
      studentCode: 'SE1840001',
      studentEmail: 'anvse1840001@fpt.edu.vn',
    }],
  );

  assert.equal(formatTeacherStudentLabel(merged), 'Nguyen Van A · SE1840001');
  assert.equal(merged.studentEmail, 'anvse1840001@fpt.edu.vn');
});

test('builds a class student list from roster, memory and sessions', () => {
  const rows = buildClassStudentRows({
    roster: [
      { studentId: 'stu-a', studentName: 'An', studentCode: 'SE01' },
      { studentId: 'stu-b', studentName: 'Binh', studentCode: 'SE02' },
    ],
    memories: [{
      studentId: 'stu-a',
      learnedTopics: ['Cache L2/L3'],
      recentQuestions: ['Core đa lõi chia sẻ cache thế nào?'],
      weakTopics: ['False sharing'],
    }],
    sessions: [{
      id: 'sess-1',
      studentId: 'stu-a',
      topic: 'Cache L2/L3',
      status: 'ACTIVE',
    }],
    summaries: [],
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].studentCode, 'SE01');
  assert.equal(rows[0].hasActivity, true);
  assert.match(rows[0].activityLabel, /Cache L2\/L3/);
  assert.deepEqual(rows[0].studiedTopics, ['Cache L2/L3']);
  assert.equal(rows[1].hasActivity, false);
  assert.equal(rows[1].activityLabel, 'Chưa học với AI Tutor');
});

test('keeps short study topics and drops memory meta phrases', () => {
  assert.equal(isShortStudyTopic('jsp'), true);
  assert.equal(isShortStudyTopic('Tóm tắt các câu hỏi gần đây'), false);
  assert.equal(isShortStudyTopic('AI Learning Improvement Plan'), false);
  assert.equal(sessionHeadline({ topic: '' }, ['jsp']), 'jsp');
  assert.match(
    sessionHeadline({ topic: 'Học tự do', updatedAt: '2026-09-04T10:15:00' }),
    /Học tự do/,
  );

  const rows = buildClassStudentRows({
    roster: [{ studentId: 'stu-a', studentName: 'An', studentCode: 'SE01' }],
    memories: [{
      studentId: 'stu-a',
      learnedTopics: ['jsp', 'Tóm tắt các câu hỏi gần đây'],
      weakTopics: ['AI Learning Improvement Plan', 'Nắm vững JSTL và Java trong JSP'],
    }],
    sessions: [],
    summaries: [],
  });
  assert.deepEqual(rows[0].studiedTopics, ['jsp']);
  assert.deepEqual(rows[0].weakTopics, ['Nắm vững JSTL và Java trong JSP']);
});

test('groups tutor summaries by student instead of repeating the UUID', () => {
  const groups = groupTutorSummariesByStudent([
    { id: 's1', studentId: 'stu-a', studentName: 'An', topic: 'Cache' },
    { id: 's2', studentId: 'stu-a', studentName: 'An', topic: 'File system' },
    { id: 's3', studentId: 'stu-b', studentName: 'Binh', topic: 'Servlet' },
  ]);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].sessions.length, 2);
  assert.equal(formatTeacherStudentLabel(groups[0].student), 'An');
  assert.equal(supportLevelLabel('HIGH_SUPPORT'), 'Hướng dẫn kỹ');
});

test('groups student rows by assigned class', () => {
  const scopes = uniqueClassScopes([
    { courseId: 'PRJ301', classId: 'SE1833' },
    { courseId: 'PRJ301', classId: 'SE1840' },
    { courseId: 'PRJ301', classId: 'SE1840' },
  ]);
  assert.deepEqual(scopes.map((scope) => scope.label), ['PRJ301 · SE1833', 'PRJ301 · SE1840']);

  const groups = groupRowsByClass([
    { studentId: 'a', classKey: 'PRJ301::SE1840', courseId: 'PRJ301', classId: 'SE1840', classLabel: 'PRJ301 · SE1840' },
    { studentId: 'b', classKey: 'PRJ301::SE1833', courseId: 'PRJ301', classId: 'SE1833', classLabel: 'PRJ301 · SE1833' },
    { studentId: 'c', classKey: 'PRJ301::SE1840', courseId: 'PRJ301', classId: 'SE1840', classLabel: 'PRJ301 · SE1840' },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].label, 'PRJ301 · SE1833');
  assert.equal(groups[1].students.length, 2);
});

test('pairs student and tutor transcript messages into chat turns', () => {
  const turns = groupTranscriptTurns([
    { id: 's1', role: 'STUDENT', content: 'JSP là gì?' },
    { id: 'a1', role: 'ASSISTANT', content: '## Kiểm tra hiểu\nA. X B. Y' },
    { id: 'a2', role: 'ASSISTANT', content: 'Chào mừng' },
  ]);
  assert.equal(turns.length, 2);
  assert.equal(turns[0].student.content, 'JSP là gì?');
  assert.equal(turns[0].tutor.role, 'ASSISTANT');
  assert.equal(turns[1].student, null);
});
