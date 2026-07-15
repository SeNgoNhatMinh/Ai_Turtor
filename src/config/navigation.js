import {
  MessageSquare,
  TrendingUp,
  BookOpen,
  ClipboardList,
  LayoutGrid,
  UploadCloud,
  CheckSquare,
  Inbox,
  BarChart3,
  Users,
  Library,
  MessageCircle,
} from 'lucide-react';
import { getWorkspaceRole } from '../constants/roles';

export const navigationItems = [
  {
    key: 'student-chat',
    workspace: 'student',
    group: 'Learning',
    label: 'AI Tutor Chat',
    description: 'Ask course questions and review past conversations.',
    icon: MessageSquare,
  },
  {
    key: 'student-memory',
    workspace: 'student',
    group: 'Learning',
    label: 'Learning Progress',
    description: 'See learned topics, weak areas, and study suggestions.',
    icon: TrendingUp,
  },
  {
    key: 'student-quizzes',
    workspace: 'student',
    group: 'Learning',
    label: 'Practice Quizzes',
    description: 'Create self-study quizzes and complete assigned quizzes.',
    icon: ClipboardList,
  },
  {
    key: 'student-materials',
    workspace: 'student',
    group: 'Coursework',
    label: 'Materials & Assignments',
    description: 'Download assignments and submit your work.',
    icon: BookOpen,
  },
  {
    key: 'student-escalation',
    workspace: 'student',
    group: 'Support',
    label: 'Teacher Support',
    description: 'Choose a teacher, chat about difficult questions, and track final answers.',
    icon: MessageCircle,
  },
  {
    key: 'teacher-classes',
    workspace: 'teacher',
    group: 'Teaching',
    label: 'Assigned Classes',
    description: 'Review classes, students, and weak topics.',
    icon: LayoutGrid,
  },
  {
    key: 'teacher-quizzes',
    workspace: 'teacher',
    group: 'Teaching',
    label: 'Quiz Assignments',
    description: 'Manage quiz assignments and review attempts.',
    icon: ClipboardList,
  },
  {
    key: 'teacher-materials',
    workspace: 'teacher',
    group: 'Teaching',
    label: 'Materials & Assignments',
    description: 'View course materials and publish class assignments.',
    icon: UploadCloud,
  },
  {
    key: 'teacher-grading',
    workspace: 'teacher',
    group: 'Teaching',
    label: 'Submission Grading',
    description: 'Review student submissions and publish feedback.',
    icon: CheckSquare,
  },
  {
    key: 'teacher-escalations',
    workspace: 'teacher',
    group: 'Support',
    label: 'Support Queue & AI Knowledge',
    description: 'Answer escalated questions and review suggested AI answers.',
    icon: Inbox,
  },
  {
    key: 'admin-dashboard',
    workspace: 'admin',
    group: 'System',
    label: 'Overview Dashboard',
    description: 'Monitor platform health and diagnostics.',
    icon: BarChart3,
  },
  {
    key: 'admin-users',
    workspace: 'admin',
    group: 'System',
    label: 'Users & Mentors',
    description: 'Manage accounts, mentors, and imports.',
    icon: Users,
  },
  {
    key: 'admin-academic',
    workspace: 'admin',
    group: 'Academic',
    label: 'Terms & Classes',
    description: 'Manage semesters, courses, and class sections.',
    icon: Library,
  },
];

export const getNavigationForRole = (role) => {
  const workspace = getWorkspaceRole(role);
  return navigationItems.filter((item) => item.workspace === workspace);
};

export const getNavigationItem = (key) => navigationItems.find((item) => item.key === key);
