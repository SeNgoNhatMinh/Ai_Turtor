import { matchPath } from 'react-router-dom';

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
  {
    role: 'teacher',
    tab: 'teacher-expert-training',
    path: '/teacher/expert-tasks',
    allowedAccountRoles: ['TEACHER'],
    navigationPath: true,
  },
  {
    role: 'teacher',
    tab: 'teacher-expert-training',
    path: '/teacher/expert-tasks/:taskId/contribute',
    allowedAccountRoles: ['TEACHER'],
  },
  {
    role: 'teacher',
    tab: 'senior-v2',
    path: '/senior/v2',
    allowedAccountRoles: ['SENIOR_MENTOR'],
    navigationPath: true,
  },
  { role: 'admin', tab: 'admin-dashboard', path: '/admin/dashboard' },
  { role: 'admin', tab: 'admin-users', path: '/admin/users' },
  { role: 'admin', tab: 'admin-academic', path: '/admin/academic' },
  { role: 'admin', tab: 'admin-review', path: '/admin/review-queue' },
  {
    role: 'admin',
    tab: 'admin-expert-training',
    path: '/admin/v2',
    allowedAccountRoles: ['ADMIN'],
    navigationPath: true,
  },
];

const tabRoutes = appRoutes.reduce((routes, route) => {
  if (route.navigationPath || !routes[route.tab]) routes[route.tab] = route.path;
  return routes;
}, {});

const legacyRouteStates = {
  '/teacher/expert-training': { role: 'teacher', tab: 'teacher-expert-training' },
  '/admin/expert-training': { role: 'admin', tab: 'admin-expert-training' },
};

export function getRouteForTab(tab) {
  return tabRoutes[tab] || '';
}

export function getHomeRouteForRole(role) {
  return roleHomeRoutes[String(role || '').toLowerCase()] || roleHomeRoutes.student;
}

export function getRouteConfig(pathname) {
  const normalizedPath = String(pathname || '').replace(/\/+$/, '') || '/';
  if (legacyRouteStates[normalizedPath]) {
    return { ...legacyRouteStates[normalizedPath], path: normalizedPath, legacy: true };
  }
  return appRoutes.find(({ path }) => matchPath({ path, end: true }, normalizedPath)) || null;
}

export function getRouteState(pathname) {
  const route = getRouteConfig(pathname);
  if (!route) return null;
  return {
    tab: route.tab,
    role: route.role,
  };
}
