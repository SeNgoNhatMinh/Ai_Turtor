import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findPersonById,
  getPersonDisplayName,
  getPersonEmail,
  getPersonId,
} from '../src/utils/displayNames.js';

test('person display helpers prefer names and email over technical IDs', () => {
  const student = {
    id: '735c44ab-47ba-4801-be8e-584a06e8ae59',
    fullName: 'Student A',
    email: 'student.a@school.local',
  };

  assert.equal(getPersonDisplayName(student, 'Student'), 'Student A');
  assert.equal(getPersonEmail(student), 'student.a@school.local');
  assert.equal(getPersonId(student), student.id);
});

test('person display helpers never use a raw ID as the visible fallback', () => {
  assert.equal(
    getPersonDisplayName({ id: '735c44ab-47ba-4801-be8e-584a06e8ae59' }, 'Student'),
    'Student',
  );
  assert.equal(
    getPersonDisplayName({ studentName: '735c44ab-47ba-4801-be8e-584a06e8ae59' }, 'Student'),
    'Student',
  );
});

test('findPersonById resolves role-specific IDs and emails', () => {
  const people = [
    { teacherId: 'teacher-a', fullName: 'Teacher A', email: 'teacher.a@school.local' },
  ];

  assert.equal(findPersonById(people, 'teacher-a')?.fullName, 'Teacher A');
  assert.equal(findPersonById(people, 'TEACHER.A@SCHOOL.LOCAL')?.fullName, 'Teacher A');
});

test('person display helpers resolve nested student and user records', () => {
  const enrollment = {
    enrollmentId: 'enrollment-1',
    student: {
      studentId: 'student-1',
      fullName: 'Nguyen Van A',
      email: 'nguyenvana@gmail.com',
    },
  };

  assert.equal(getPersonId(enrollment), 'student-1');
  assert.equal(getPersonDisplayName(enrollment, 'Student'), 'Nguyen Van A');
  assert.equal(getPersonEmail(enrollment), 'nguyenvana@gmail.com');
});
