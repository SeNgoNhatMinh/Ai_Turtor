export const roleHomeRoutes = {
  student: '/student/chat',
  teacher: '/teacher/classes',
  admin: '/admin/dashboard',
};

export const tabRoutes = {
  'student-chat': '/student/chat',
  'student-memory': '/student/progress',
  'student-quizzes': '/student/quizzes',
  'student-materials': '/student/materials',
  'student-escalation': '/student/mentor-review',
  'teacher-classes': '/teacher/classes',
  'teacher-quizzes': '/teacher/quizzes',
  'teacher-materials': '/teacher/materials',
  'teacher-grading': '/teacher/grading',
  'teacher-escalations': '/teacher/review-queue',
  'admin-dashboard': '/admin/dashboard',
  'admin-users': '/admin/users',
  'admin-academic': '/admin/academic',
};

const routeEntries = Object.entries(tabRoutes).map(([tab, path]) => [path, tab]);

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
  const [, tab] = match;
  return {
    tab,
    role: tab.split('-')[0],
  };
}
