export const BEHAVIOR_DOMAINS = [
  { value: 'OOP', label: 'Lập trình hướng đối tượng (OOP)' },
  { value: 'WEB', label: 'Lập trình web' },
  { value: 'DATABASE', label: 'Cơ sở dữ liệu' },
  { value: 'DATA_STRUCTURE', label: 'Cấu trúc dữ liệu' },
  { value: 'ALGORITHM', label: 'Thuật toán' },
  { value: 'OPERATING_SYSTEM', label: 'Hệ điều hành' },
  { value: 'NETWORK', label: 'Mạng máy tính' },
  { value: 'SECURITY', label: 'Bảo mật' },
  { value: 'AI_ML', label: 'AI / Machine learning' },
  { value: 'MOBILE', label: 'Lập trình di động' },
  { value: 'GENERAL_STUDY', label: 'Kỹ năng học chung' },
];

export const BEHAVIOR_SCOPE_LABELS = {
  STUDENT: 'Riêng sinh viên',
  COURSE: 'Theo môn',
  DOMAIN: 'Theo domain',
  GLOBAL: 'Toàn hệ thống',
};

export const BEHAVIOR_SCOPE_COLORS = {
  STUDENT: 'purple',
  COURSE: 'blue',
  DOMAIN: 'cyan',
  GLOBAL: 'gold',
};

export const BEHAVIOR_STATUS_LABELS = {
  AI_PENDING: 'AI đề xuất · chờ duyệt',
  APPROVED: 'Đang dùng',
  REJECTED: 'Đã từ chối',
  RETIRED: 'Đã tắt',
};

export const BEHAVIOR_STATUS_COLORS = {
  AI_PENDING: 'gold',
  APPROVED: 'green',
  REJECTED: 'red',
  RETIRED: 'default',
};

export const SUPPORT_LEVEL_OPTIONS = [
  { value: 'HIGH_SUPPORT', label: 'Hỗ trợ cao' },
  { value: 'STANDARD', label: 'Tiêu chuẩn' },
  { value: 'CHALLENGE', label: 'Thử thách' },
];

export const SHARE_SCOPE_OPTIONS = [
  { value: '', label: 'Không chia sẻ (chỉ sinh viên này)' },
  { value: 'COURSE', label: 'Chia sẻ cho môn này' },
  { value: 'DOMAIN', label: 'Chia sẻ theo domain (mọi môn cùng domain)' },
  { value: 'GLOBAL', label: 'Chia sẻ toàn hệ thống' },
];

export const MAX_BEHAVIOR_LENGTH = 500;

export const EXPLANATION_STRATEGIES = [
  'Giải thích khái niệm',
  'Ví dụ thực tế',
  'Minh họa trực quan',
  'Bảng so sánh',
  'Bài tập có hướng dẫn',
  'Tự kiểm tra',
].map((value) => ({ value, label: value }));

export function domainLabel(value) {
  return BEHAVIOR_DOMAINS.find((item) => item.value === value)?.label || value || '';
}
