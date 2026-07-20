const roleHomeRoutes = {
  student: '/student/chat',
  teacher: '/teacher/classes',
  admin: '/admin/dashboard',
};

export const appRoutes = [
  { role: 'student', tab: 'student-chat', path: '/student/chat' },
  { role: 'student', tab: 'student-memory', path: '/student/progress' },
  { role: 'student', tab: 'student-quizzes', path: '/student/quizzes' },
  { role: 'student', tab: 'student-materials', path: '/student/materials' },
  { role: 'student', tab: 'student-escalation', path: '/student/mentor-review' },
  { role: 'teacher', tab: 'teacher-classes', path: '/teacher/classes' },
  { role: 'teacher', tab: 'teacher-quizzes', path: '/teacher/quizzes' },
  { role: 'teacher', tab: 'teacher-materials', path: '/teacher/materials' },
  { role: 'teacher', tab: 'teacher-grading', path: '/teacher/grading' },
  { role: 'teacher', tab: 'teacher-escalations', path: '/teacher/review-queue' },
  { role: 'teacher', tab: 'teacher-expert-training', path: '/teacher/expert-training' },
  { role: 'admin', tab: 'admin-dashboard', path: '/admin/dashboard' },
  { role: 'admin', tab: 'admin-users', path: '/admin/users' },
  { role: 'admin', tab: 'admin-academic', path: '/admin/academic' },
  { role: 'admin', tab: 'admin-review', path: '/admin/review-queue' },
  { role: 'admin', tab: 'admin-expert-training', path: '/admin/expert-training' },
];

const tabRoutes = Object.fromEntries(appRoutes.map(({ tab, path }) => [tab, path]));

const routeEntries = appRoutes.map(({ path, tab, role }) => [path, tab, role]);

export function getRouteForTab(tab) {
  return tabRoutes[tab] || '';
}

export function getHomeRouteForRole(role) {
  return roleHomeRoutes[String(role || '').toLowerCase()] || roleHomeRoutes.student;
}

export function getRouteState(pathname) {
  const normalizedPath = String(pathname || '').replace(/\/+$/, '') || '/';
  const match = routeEntries.find(([path]) => normalizedPath === path);
  if (!match) return null;
  const [, tab, role] = match;
  return {
    tab,
    role,
  };
}
