const codeModeLabel = 'Xem xét mã nguồn';
const codeModeDisclaimer =
    'Câu trả lời này do AI tự phân tích bằng kiến thức lập trình chung, không trích từ tài liệu môn học.';

bool isCodeMentorMode(String? mode) {
  final value = (mode ?? '').trim().toUpperCase();
  return value == 'CODE' || value == 'CODE_MENTOR';
}
