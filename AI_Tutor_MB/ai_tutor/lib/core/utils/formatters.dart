import 'package:intl/intl.dart';

final vnDateFormat = DateFormat('dd/MM/yyyy', 'vi');
final vnDateTimeFormat = DateFormat('dd/MM/yyyy HH:mm', 'vi');
final vnDayFormat = DateFormat('EEEE, dd/MM/yyyy', 'vi');

String formatFileSize(int bytes) {
  if (bytes < 1024) return '$bytes B';
  if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
  return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
}

String formatRelativeTime(DateTime dateTime) {
  final diff = DateTime.now().difference(dateTime);
  if (diff.inMinutes < 1) return 'Vừa xong';
  if (diff.inHours < 1) return '${diff.inMinutes} phút trước';
  if (diff.inDays < 1) return '${diff.inHours} giờ trước';
  if (diff.inDays < 7) return '${diff.inDays} ngày trước';
  return vnDateFormat.format(dateTime);
}

String formatDueCountdown(DateTime dueAt) {
  final diff = dueAt.difference(DateTime.now());
  if (diff.isNegative) return 'Quá hạn';
  if (diff.inDays >= 1) return 'Còn ${diff.inDays} ngày';
  if (diff.inHours >= 1) return 'Còn ${diff.inHours} giờ';
  return 'Còn ${diff.inMinutes} phút';
}

bool isDueWithinHours(DateTime? dueAt, int hours) {
  if (dueAt == null) return false;
  final diff = dueAt.difference(DateTime.now());
  return !diff.isNegative && diff.inHours < hours;
}

String formatDueShort(DateTime dueAt) {
  return DateFormat('dd/MM HH:mm', 'vi').format(dueAt);
}

int riskPercentForLevel(String level) {
  return switch (level.toUpperCase()) {
    'HIGH' => 85,
    'MEDIUM' => 60,
    'LOW' => 30,
    _ => 45,
  };
}
