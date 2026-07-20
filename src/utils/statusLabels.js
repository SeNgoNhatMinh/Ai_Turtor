const STATUS_META = Object.freeze({
  OPEN: { color: 'default', label: 'Chưa có người nhận' },
  PENDING: { color: 'orange', label: 'Đang chờ xử lý' },
  QUEUED: { color: 'orange', label: 'Đang xếp hàng' },
  PENDING_OFFER: { color: 'orange', label: 'Đang tìm giảng viên phù hợp' },
  OFFERED: { color: 'blue', label: 'Đã có giảng viên phù hợp' },
  ASSIGNED: { color: 'blue', label: 'Đã giao' },
  MENTOR_SELECTED: { color: 'blue', label: 'Đã chọn giảng viên' },
  IN_PROGRESS: { color: 'blue', label: 'Đang thực hiện' },
  CHAT_ACTIVE: { color: 'green', label: 'Đang trao đổi' },
  IN_CHAT: { color: 'green', label: 'Đang trao đổi' },
  MENTOR_MATCHING: { color: 'blue', label: 'Đang tìm giảng viên' },
  SUBMITTED: { color: 'orange', label: 'Đã nộp' },
  DRAFT: { color: 'default', label: 'Bản nháp' },
  GENERATED: { color: 'blue', label: 'Đã tạo' },
  PUBLISHED: { color: 'green', label: 'Đã xuất bản' },
  AVAILABLE: { color: 'green', label: 'Có thể làm' },
  REVIEWED: { color: 'green', label: 'Đã duyệt điểm' },
  AUTO_GRADED: { color: 'blue', label: 'Đã chấm tự động' },
  SUGGESTED: { color: 'blue', label: 'Có điểm gợi ý' },
  INDEXING: { color: 'blue', label: 'Đang lập chỉ mục' },
  INDEXING_FAILED: { color: 'red', label: 'Lập chỉ mục thất bại' },
  READY: { color: 'green', label: 'Sẵn sàng' },
  ARCHIVED: { color: 'default', label: 'Đã lưu trữ' },
  PENDING_REVIEW: { color: 'orange', label: 'Chờ kiểm duyệt' },
  NEEDS_MENTOR_REVIEW: { color: 'orange', label: 'Chờ giảng viên kiểm tra' },
  NEEDS_SENIOR_REVIEW: { color: 'purple', label: 'Chờ Senior Mentor kiểm tra' },
  ANSWERED_NO_KNOWLEDGE_CANDIDATE: { color: 'green', label: 'Đã trả lời' },
  ANSWERED_PENDING_SENIOR_REVIEW: { color: 'purple', label: 'Đã trả lời · Chờ duyệt tri thức' },
  COMPLETED: { color: 'green', label: 'Hoàn tất' },
  DONE: { color: 'green', label: 'Hoàn tất' },
  CANCELLED: { color: 'default', label: 'Đã hủy' },
  CLOSED: { color: 'default', label: 'Đã đóng' },
  ACTIVE: { color: 'green', label: 'Đang hoạt động' },
  INACTIVE: { color: 'default', label: 'Ngừng hoạt động' },
  APPROVED: { color: 'green', label: 'Đã phê duyệt' },
  INDEXED: { color: 'green', label: 'Đã đưa vào RAG' },
  REJECTED: { color: 'red', label: 'Cần chỉnh sửa' },
  RESOLVED: { color: 'green', label: 'Đã xử lý' },
  TASK_CREATED: { color: 'blue', label: 'Đã tạo công việc' },
  RUNNING: { color: 'blue', label: 'Đang chạy' },
  PROCESSING: { color: 'blue', label: 'Đang xử lý' },
  PASSED: { color: 'green', label: 'Đạt' },
  FAILED: { color: 'red', label: 'Chưa đạt' },
  ERROR: { color: 'red', label: 'Có lỗi' },
  CRITICAL: { color: 'red', label: 'Nghiêm trọng' },
  HIGH: { color: 'orange', label: 'Cao' },
  MEDIUM: { color: 'blue', label: 'Trung bình' },
  LOW: { color: 'green', label: 'Thấp' },
});

function normalizeStatus(status) {
  return String(status || '').trim().toUpperCase();
}

export function getStatusMeta(status) {
  const normalized = normalizeStatus(status);
  return STATUS_META[normalized] || {
    color: 'default',
    label: normalized ? normalized.replaceAll('_', ' ') : 'Chưa xác định',
  };
}

export function getStatusLabel(status) {
  return getStatusMeta(status).label;
}
