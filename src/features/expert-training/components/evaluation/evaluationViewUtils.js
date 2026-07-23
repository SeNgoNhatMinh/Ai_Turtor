export function formatEvaluationDate(value) {
  if (!value) return 'Chưa hoàn tất';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa hoàn tất' : date.toLocaleString('vi-VN');
}
