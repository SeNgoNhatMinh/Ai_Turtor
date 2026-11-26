// Shared labels for the experience survey (student form and admin summary).
export const RATING_QUESTIONS = [
  { key: 'overall', label: 'Mức độ hài lòng chung với AI Tutor', low: 'Rất không hài lòng', high: 'Rất hài lòng' },
  { key: 'aiQuality', label: 'Câu trả lời của AI đúng và dễ hiểu', low: 'Rất kém', high: 'Rất tốt' },
  { key: 'speed', label: 'Tốc độ AI trả lời', low: 'Rất chậm', high: 'Rất nhanh' },
  { key: 'easeOfUse', label: 'Giao diện dễ sử dụng', low: 'Rất khó dùng', high: 'Rất dễ dùng' },
];

export const DEVICE_OPTIONS = [
  { value: 'COMPUTER', label: 'Máy tính' },
  { value: 'PHONE', label: 'Điện thoại' },
  { value: 'TABLET', label: 'Máy tính bảng' },
];

export const FEATURE_OPTIONS = [
  { value: 'CHAT', label: 'Trò chuyện với AI Tutor' },
  { value: 'LESSONS', label: 'Học theo lộ trình / Học ngay' },
  { value: 'QUIZ', label: 'Quiz luyện tập' },
  { value: 'MATERIALS', label: 'Tài liệu học tập' },
  { value: 'TEACHER_SUPPORT', label: 'Hỗ trợ từ giảng viên' },
];

export const labelOf = (options, value) => options.find((option) => option.value === value)?.label || value || '';
