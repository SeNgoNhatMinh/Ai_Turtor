export const normalizeAppRole = (role, email = '') => {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'admin') return 'admin';
  if (normalized === 'teacher' || normalized === 'mentor') return 'teacher';
  if (normalized === 'student') return 'student';

  const safeEmail = String(email || '').toLowerCase();
  if (safeEmail.includes('admin')) return 'admin';
  if (safeEmail.includes('teacher') || safeEmail.includes('mentor')) return 'teacher';
  return 'student';
};
