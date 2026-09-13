import 'package:ai_tutor/core/utils/conversation_time_groups.dart';
import 'package:ai_tutor/shared/models/ai_conversation.dart';
import 'package:flutter_test/flutter_test.dart';

AiConversation _session(String id, DateTime? lastMessageAt) {
  return AiConversation(
    id: id,
    title: id,
    lastMessageAt: lastMessageAt,
  );
}

void main() {
  final now = DateTime(2026, 9, 13, 21);

  test('groups conversations by web-style time buckets', () {
    final sessions = [
      _session('today', now),
      _session('yesterday', now.subtract(const Duration(days: 1))),
      _session('week', now.subtract(const Duration(days: 4))),
      _session('month', now.subtract(const Duration(days: 18))),
      _session('older', now.subtract(const Duration(days: 40))),
      _session('empty', null),
    ];

    final groups = groupConversationsByTime(sessions, now: now);
    expect(groups.map((group) => group.label), [
      'Hôm nay',
      'Hôm qua',
      '7 ngày trước',
      '30 ngày trước',
      'Cũ hơn',
    ]);
    expect(groups.last.items.map((item) => item.id), ['older', 'empty']);
  });

  test('sorts by latest activity first', () {
    final older = _session('older', now.subtract(const Duration(hours: 3)));
    final newer = _session('newer', now);
    final sorted = sortConversationsByActivity([older, newer]);
    expect(sorted.map((item) => item.id), ['newer', 'older']);
  });
}
