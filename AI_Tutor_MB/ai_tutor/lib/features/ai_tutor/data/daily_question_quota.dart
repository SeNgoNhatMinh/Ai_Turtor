import '../../../core/utils/json_helpers.dart';

const dailyCourseQuestionLimit = 10;

const dailySessionCompleteTitle = 'Phiên học hôm nay đã hết';
const dailySessionCompleteMessage = 'Cảm ơn bạn đã học cùng mình.';
const dailySessionCompleteHint =
    'Mỗi môn được hỏi 10 câu mỗi ngày. Bạn có thể hỏi môn khác, hoặc quay lại môn này vào ngày mai.';

class DailyQuestionQuota {
  const DailyQuestionQuota({
    this.courseId = '',
    this.used = 0,
    this.remaining = dailyCourseQuestionLimit,
    this.limit = dailyCourseQuestionLimit,
    this.resetAt,
  });

  factory DailyQuestionQuota.defaults({String courseId = ''}) {
    return DailyQuestionQuota(courseId: courseId);
  }

  final String courseId;
  final int used;
  final int remaining;
  final int limit;
  final DateTime? resetAt;

  bool get exhausted => remaining <= 0;

  DailyQuestionQuota copyWith({
    String? courseId,
    int? used,
    int? remaining,
    int? limit,
    DateTime? resetAt,
  }) {
    return DailyQuestionQuota(
      courseId: courseId ?? this.courseId,
      used: used ?? this.used,
      remaining: remaining ?? this.remaining,
      limit: limit ?? this.limit,
      resetAt: resetAt ?? this.resetAt,
    );
  }

  DailyQuestionQuota exhaustedCopy() {
    return copyWith(used: limit, remaining: 0);
  }

  @override
  bool operator ==(Object other) =>
      other is DailyQuestionQuota &&
      other.courseId == courseId &&
      other.used == used &&
      other.remaining == remaining &&
      other.limit == limit &&
      other.resetAt == resetAt;

  @override
  int get hashCode => Object.hash(courseId, used, remaining, limit, resetAt);
}

bool hasQuotaPayload(dynamic payload) {
  if (payload is! Map) return false;
  return payload['dailyQuestionUsed'] != null ||
      payload['used'] != null ||
      payload['dailyQuestionRemaining'] != null ||
      payload['remaining'] != null;
}

DailyQuestionQuota normalizeDailyQuota(
  dynamic payload, {
  String courseId = '',
}) {
  if (payload is! Map) {
    return DailyQuestionQuota.defaults(courseId: courseId);
  }
  final map = Map<String, dynamic>.from(payload);
  final parsedLimit =
      (map['dailyLimit'] as num?)?.toInt() ??
      (map['dailyQuestionLimit'] as num?)?.toInt() ??
      dailyCourseQuestionLimit;
  final limit = parsedLimit > 0 ? parsedLimit : dailyCourseQuestionLimit;
  final usedRaw =
      (map['used'] as num?)?.toInt() ??
      (map['dailyQuestionUsed'] as num?)?.toInt() ??
      0;
  final used = usedRaw.clamp(0, limit);
  final remaining =
      map['remaining'] != null || map['dailyQuestionRemaining'] != null
      ? ((map['remaining'] as num?)?.toInt() ??
                (map['dailyQuestionRemaining'] as num?)?.toInt() ??
                0)
            .clamp(0, limit)
      : (limit - used).clamp(0, limit);
  return DailyQuestionQuota(
    courseId: map['courseId']?.toString() ?? courseId,
    used: used,
    remaining: remaining,
    limit: limit,
    resetAt: parseDateTime(map['resetAt']),
  );
}
