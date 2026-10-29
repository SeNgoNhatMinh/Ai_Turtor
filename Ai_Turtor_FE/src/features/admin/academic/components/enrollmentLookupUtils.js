const isActiveEnrollment = (item) => {
  const status = String(item?.status || 'ACTIVE').toUpperCase();
  return status !== 'DROPPED' && status !== 'INACTIVE';
};

const getStudentKey = (item) => {
  const email = String(item?.studentEmail || '').trim().toLowerCase();
  if (email) return `email:${email}`;
  const studentId = String(item?.studentId || '').trim().toLowerCase();
  if (studentId) return `id:${studentId}`;
  const studentCode = String(item?.studentCode || '').trim().toLowerCase();
  if (studentCode) return `code:${studentCode}`;
  return String(item?.id || '').trim().toLowerCase();
};

// One row per registered email (or studentId) with every course/class they are enrolled in.
export const groupByStudent = (enrollments) => {
  const byStudent = new Map();
  enrollments.forEach((item) => {
    const key = getStudentKey(item);
    if (!key) return;
    const current = byStudent.get(key) || {
      id: `student-${key}`,
      studentId: item.studentId,
      studentCode: item.studentCode,
      studentName: item.studentName,
      studentEmail: item.studentEmail,
      enrollments: [],
    };
    current.studentName = item.studentName || current.studentName;
    current.studentEmail = item.studentEmail || current.studentEmail;
    current.studentCode = current.studentCode || item.studentCode;
    if (String(item?.studentId || '').includes('-')) current.studentId = item.studentId;
    current.enrollments.push(item);
    byStudent.set(key, current);
  });
  return Array.from(byStudent.values()).map((student) => {
    const active = student.enrollments.filter(isActiveEnrollment);
    return {
      ...student,
      activeCount: active.length,
      courseSummary: student.enrollments.map((item) => `${item.courseId} ${item.classId}`).join(' '),
    };
  });
};
