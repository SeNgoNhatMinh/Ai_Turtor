export function isTeacherOwnedMaterial(material, teacherUserId) {
  return Boolean(
    teacherUserId
    && String(material?.teacherId || '') === String(teacherUserId)
    && String(material?.uploadedByRole || '').toUpperCase() === 'TEACHER'
    && String(material?.materialScope || '').toUpperCase() === 'CLASS_SECTION',
  );
}
