import {
  MessageSquare,
  BookOpen,
  ClipboardList,
  LayoutGrid,
  UploadCloud,
  CheckSquare,
  Inbox,
  BarChart3,
  Users,
  GraduationCap,
  AlertTriangle,
  Library,
  MessageCircle,
  BrainCircuit,
  FileText,
  House,
  RefreshCw,
  Database,
} from 'lucide-react';
import { ACCOUNT_ROLES, getWorkspaceRole, normalizeAccountRole } from '../constants/roles';

const navigationItems = [
  {
    key: 'student-dashboard',
    workspace: 'student',
    group: 'Học tập',
    label: 'Tổng quan',
    description: 'Xem nhanh các môn đang học, lớp tham gia và lối tắt học tập.',
    icon: House,
  },
  {
    key: 'student-chat',
    workspace: 'student',
    group: 'Học tập',
    label: 'Trò chuyện AI Tutor',
    description: 'Hỏi theo môn học và xem lại lịch sử trò chuyện.',
    icon: MessageSquare,
  },
  {
    key: 'student-quizzes',
    workspace: 'student',
    group: 'Học tập',
    label: 'Quiz luyện tập',
    description: 'Tạo quiz tự ôn và làm quiz được giảng viên giao.',
    icon: ClipboardList,
  },
  {
    key: 'student-materials',
    workspace: 'student',
    group: 'Học liệu',
    label: 'Tài liệu học tập',
    description: 'Xem và tải tài liệu do giảng viên chia sẻ.',
    icon: BookOpen,
  },
  {
    key: 'student-assignments',
    workspace: 'student',
    group: 'Học liệu',
    label: 'Bài tập',
    description: 'Xem đề, theo dõi hạn nộp và gửi bài làm.',
    icon: FileText,
  },
  {
    key: 'student-escalation',
    workspace: 'student',
    group: 'Hỗ trợ',
    label: 'Hỗ trợ từ giảng viên',
    description: 'Trao đổi câu hỏi khó và theo dõi câu trả lời chính thức.',
    icon: MessageCircle,
  },
  {
    key: 'teacher-classes',
    workspace: 'teacher',
    allowedAccountRoles: [ACCOUNT_ROLES.TEACHER],
    group: 'Giảng dạy',
    label: 'Lớp được phân công',
    description: 'Xem lớp, sinh viên và các chủ đề còn yếu.',
    icon: LayoutGrid,
  },
  {
    key: 'teacher-quizzes',
    workspace: 'teacher',
    allowedAccountRoles: [ACCOUNT_ROLES.TEACHER],
    group: 'Giảng dạy',
    label: 'Quiz được giao',
    description: 'Tạo, xuất bản quiz và duyệt bài làm của sinh viên.',
    icon: ClipboardList,
  },
  {
    key: 'teacher-materials',
    workspace: 'teacher',
    allowedAccountRoles: [ACCOUNT_ROLES.TEACHER],
    group: 'Giảng dạy',
    label: 'Tài liệu & bài tập',
    description: 'Xem học liệu và giao bài tập cho lớp.',
    icon: UploadCloud,
  },
  {
    key: 'teacher-grading',
    workspace: 'teacher',
    allowedAccountRoles: [ACCOUNT_ROLES.TEACHER],
    group: 'Giảng dạy',
    label: 'Chấm bài nộp',
    description: 'Chấm bài sinh viên và công bố nhận xét.',
    icon: CheckSquare,
  },
  {
    key: 'teacher-escalations',
    workspace: 'teacher',
    allowedAccountRoles: [ACCOUNT_ROLES.TEACHER],
    group: 'Hỗ trợ',
    label: 'Hàng chờ hỗ trợ & tri thức AI',
    description: 'Xử lý câu hỏi được chuyển lên và kiểm tra phản hồi AI.',
    icon: Inbox,
  },
  {
    key: 'teacher-tutoring',
    workspace: 'teacher',
    allowedAccountRoles: [ACCOUNT_ROLES.TEACHER],
    group: 'Hỗ trợ',
    label: 'Theo dõi AI Tutor',
    description: 'Xem buổi học và truyền chỉ dẫn sư phạm theo từng sinh viên.',
    icon: BrainCircuit,
  },
  {
    key: 'teacher-expert-training',
    workspace: 'teacher',
    allowedAccountRoles: [ACCOUNT_ROLES.TEACHER],
    group: 'Chất lượng AI',
    label: 'Q&A huấn luyện AI',
    description: 'Nhận việc viết Q&A vàng theo chương giáo trình.',
    icon: BrainCircuit,
  },
  {
    key: 'senior-v2',
    workspace: 'senior',
    allowedAccountRoles: [ACCOUNT_ROLES.SENIOR_MENTOR],
    group: 'Kiểm duyệt chuyên môn',
    label: 'Huấn luyện AI',
    description: 'Mục lục sách, giao Q&A vàng, xem bài đánh giá rồi nạp RAG.',
    icon: BrainCircuit,
  },
  {
    key: 'senior-review',
    workspace: 'senior',
    allowedAccountRoles: [ACCOUNT_ROLES.SENIOR_MENTOR],
    group: 'Kiểm duyệt chuyên môn',
    label: 'Trung tâm kiểm duyệt',
    description: 'Xử lý phản hồi nghiêm trọng và Knowledge Candidate, không can thiệp chat lớp.',
    icon: Inbox,
  },
  {
    key: 'senior-answer-cache',
    workspace: 'senior',
    allowedAccountRoles: [ACCOUNT_ROLES.SENIOR_MENTOR],
    group: 'Kiểm duyệt chuyên môn',
    label: 'Cache câu trả lời AI',
    description: 'Duyệt, sửa hoặc tắt câu trả lời AI đã cache theo semantic similarity.',
    icon: Database,
  },
  {
    key: 'admin-dashboard',
    workspace: 'admin',
    group: 'Hệ thống',
    label: 'Tổng quan hệ thống',
    description: 'Theo dõi trạng thái nền tảng và chẩn đoán kỹ thuật.',
    icon: BarChart3,
  },
  {
    key: 'admin-users',
    workspace: 'admin',
    group: 'Hệ thống',
    label: 'Tài khoản',
    description: 'Xem tài khoản theo từng vai trò.',
    icon: Users,
    children: [
      {
        key: 'admin-users-students',
        label: 'Sinh viên',
        description: 'Tài khoản sinh viên, kể cả tài khoản đã khóa.',
      },
      {
        key: 'admin-users-teachers',
        label: 'Giảng viên',
        description: 'Tài khoản giảng viên, kể cả tài khoản đã khóa.',
      },
      {
        key: 'admin-users-senior-mentors',
        label: 'Senior Mentor',
        description: 'Tài khoản senior mentor, kể cả tài khoản đã khóa.',
      },
      {
        key: 'admin-users-admins',
        label: 'Quản trị viên',
        description: 'Tài khoản quản trị, kể cả tài khoản đã khóa.',
      },
    ],
  },
  {
    key: 'admin-users-mentors',
    workspace: 'admin',
    group: 'Hệ thống',
    label: 'Hồ sơ giảng viên',
    description: 'Hồ sơ giảng viên và import dữ liệu giảng viên.',
    icon: GraduationCap,
  },
  {
    key: 'admin-users-escalations',
    workspace: 'admin',
    group: 'Hệ thống',
    label: 'Yêu cầu hỗ trợ',
    description: 'Các yêu cầu hỗ trợ đang chờ xử lý.',
    icon: AlertTriangle,
  },
  {
    key: 'admin-academic-semesters',
    workspace: 'admin',
    group: 'Học vụ',
    label: 'Học kỳ',
    description: 'Tạo và cập nhật học kỳ.',
    icon: Library,
  },
  {
    key: 'admin-academic-courses',
    workspace: 'admin',
    group: 'Học vụ',
    label: 'Môn học',
    description: 'Quản lý môn học.',
    icon: BookOpen,
  },
  {
    key: 'admin-academic-classes',
    workspace: 'admin',
    group: 'Học vụ',
    label: 'Lớp học phần',
    description: 'Quản lý lớp học phần và giảng viên phụ trách.',
    icon: LayoutGrid,
  },
  {
    key: 'admin-academic-enrollments',
    workspace: 'admin',
    group: 'Học vụ',
    label: 'Ghi danh',
    description: 'Ghi danh sinh viên vào lớp.',
    icon: ClipboardList,
  },
  {
    key: 'admin-academic-import',
    workspace: 'admin',
    group: 'Học vụ',
    label: 'Import sinh viên',
    description: 'Nhập danh sách sinh viên từ tệp.',
    icon: UploadCloud,
  },
  {
    key: 'admin-academic-materials',
    workspace: 'admin',
    group: 'Học vụ',
    label: 'Học liệu',
    description: 'Học liệu dùng chung theo môn.',
    icon: FileText,
  },
  {
    key: 'admin-academic-curriculum',
    workspace: 'admin',
    group: 'Học vụ',
    label: 'Curriculum AI',
    description: 'Chỉnh curriculum guide cho AI Tutor.',
    icon: BrainCircuit,
  },
  {
    key: 'admin-reindex',
    workspace: 'admin',
    allowedAccountRoles: [ACCOUNT_ROLES.ADMIN],
    group: 'Giám sát AI',
    label: 'Reindex tài liệu',
    description: 'Tạo lại chỉ mục chữ và hình ảnh cho toàn bộ học liệu trong hệ thống.',
    icon: RefreshCw,
  },
  {
    key: 'admin-indexed-notes',
    workspace: 'admin',
    allowedAccountRoles: [ACCOUNT_ROLES.ADMIN],
    group: 'Giám sát AI',
    label: 'Index Senior đã duyệt (RAG)',
    description: 'Xem/sửa/gỡ các knowledge Senior V2 đã nạp vào Elasticsearch.',
    icon: BookOpen,
  },
  {
    key: 'admin-ai-logs',
    workspace: 'admin',
    group: 'Giám sát AI',
    label: 'Nhật ký trả lời AI',
    description: 'Quản lý provider, thống kê runtime và lịch sử yêu cầu.',
    icon: FileText,
    children: [
      {
        key: 'admin-ai-logs-providers',
        label: 'Quản lý LLM Provider Chain',
        description: 'Thứ tự ưu tiên, model và thao tác bật tắt provider.',
      },
      {
        key: 'admin-ai-logs-stats',
        label: 'Thống kê runtime theo provider',
        description: 'Số lần gọi, thành công và cooldown của từng provider.',
      },
      {
        key: 'admin-ai-logs-history',
        label: 'Lịch sử yêu cầu',
        description: 'Nhật ký câu hỏi, câu trả lời và trạng thái xử lý.',
      },
    ],
  },
  {
    key: 'admin-answer-cache',
    workspace: 'admin',
    allowedAccountRoles: [ACCOUNT_ROLES.ADMIN],
    group: 'Giám sát AI',
    label: 'Cache câu trả lời AI',
    description: 'Quản lý cache semantic: duyệt, sửa, tắt hoặc xóa câu trả lời AI đã lưu.',
    icon: Database,
  },
];

export const getNavigationForRole = (role) => {
  const accountRole = normalizeAccountRole(role);
  const workspace = getWorkspaceRole(accountRole);
  const items = navigationItems.filter((item) => (
    item.workspace === workspace
    && (!item.allowedAccountRoles || item.allowedAccountRoles.includes(accountRole))
  ));
  if (workspace === 'senior') {
    const order = { 'senior-review': 0, 'senior-answer-cache': 1, 'senior-v2': 2 };
    return items.sort((left, right) => (order[left.key] ?? 99) - (order[right.key] ?? 99));
  }
  return items;
};

export function groupAdminNavigation(items) {
  if (!items?.length || !items.every((item) => item.workspace === 'admin')) return items || [];
  const groups = [];
  const byLabel = new Map();
  for (const item of items) {
    const label = item.group || 'Khác';
    let group = byLabel.get(label);
    if (!group) {
      group = { type: 'group', key: `nav-group-${label}`, label, children: [] };
      byLabel.set(label, group);
      groups.push(group);
    }
    group.children.push(item);
  }
  return groups;
}

export function resolveNavigationSelection(activeTab) {
  if (activeTab === 'admin-ai-logs') return 'admin-ai-logs-providers';
  if (activeTab === 'admin-users') return 'admin-users-students';
  if (activeTab === 'admin-academic') return 'admin-academic-semesters';
  return activeTab || '';
}

export function findOpenMenuKey(items, selectedKey) {
  for (const item of items || []) {
    if (item.children?.some((child) => child.key === selectedKey)) return item.key;
  }
  return '';
}

export function findNavigationItem(items, key) {
  for (const item of items || []) {
    if (item.key === key) return item;
    const child = (item.children || []).find((entry) => entry.key === key);
    if (child) return child;
  }
  return null;
}
