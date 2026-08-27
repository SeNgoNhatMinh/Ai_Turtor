import { describe, expect, it } from 'vitest';
import { isTeacherOwnedMaterial } from '../../src/features/teacher/materials/teacherMaterialPermissions';

describe('teacher material permissions', () => {
  it('allows a teacher to manage their own class material', () => {
    expect(isTeacherOwnedMaterial({
      teacherId: 'teacher-1',
      uploadedByRole: 'TEACHER',
      materialScope: 'CLASS_SECTION',
    }, 'teacher-1')).toBe(true);
  });

  it('keeps main material read-only even when a legacy teacherId matches', () => {
    expect(isTeacherOwnedMaterial({
      teacherId: 'teacher-1',
      uploadedByRole: 'ADMIN',
      materialScope: 'COURSE_SHARED',
    }, 'teacher-1')).toBe(false);
  });

  it('does not allow managing another teachers upload', () => {
    expect(isTeacherOwnedMaterial({
      teacherId: 'teacher-2',
      uploadedByRole: 'TEACHER',
      materialScope: 'CLASS_SECTION',
    }, 'teacher-1')).toBe(false);
  });
});
