import '../../shared/models/ai_conversation.dart';

DateTime _activityDate(AiConversation session) {
  return session.lastMessageAt ?? DateTime.fromMillisecondsSinceEpoch(0);
}

DateTime _startOfDay(DateTime date) => DateTime(date.year, date.month, date.day);

int _dayDiff(DateTime date, DateTime now) {
  return _startOfDay(now).difference(_startOfDay(date)).inDays;
}

String conversationTimeGroup(AiConversation session, {DateTime? now}) {
  final current = now ?? DateTime.now();
  final activity = _activityDate(session);
  if (activity.millisecondsSinceEpoch == 0) return 'Cũ hơn';
  final diff = _dayDiff(activity, current);
  if (diff <= 0) return 'Hôm nay';
  if (diff == 1) return 'Hôm qua';
  if (diff <= 7) return '7 ngày trước';
  if (diff <= 30) return '30 ngày trước';
  return 'Cũ hơn';
}

const conversationTimeGroupOrder = [
  'Hôm nay',
  'Hôm qua',
  '7 ngày trước',
  '30 ngày trước',
  'Cũ hơn',
];

const conversationPageSize = 50;

List<AiConversation> sortConversationsByActivity(
  List<AiConversation> sessions,
) {
  return [...sessions]
    ..sort((a, b) => _activityDate(b).compareTo(_activityDate(a)));
}

List<({String label, List<AiConversation> items})> groupConversationsByTime(
  List<AiConversation> sessions, {
  DateTime? now,
}) {
  final current = now ?? DateTime.now();
  final grouped = <String, List<AiConversation>>{};
  final sorted = sortConversationsByActivity(sessions);
  for (final session in sorted) {
    final label = conversationTimeGroup(session, now: current);
    grouped.putIfAbsent(label, () => []).add(session);
  }
  return conversationTimeGroupOrder
      .where((label) => grouped[label]?.isNotEmpty == true)
      .map((label) => (label: label, items: grouped[label]!))
      .toList();
}
