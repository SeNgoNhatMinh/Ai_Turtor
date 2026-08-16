import '../../core/utils/json_helpers.dart';

class MentorCandidate {
  const MentorCandidate({
    required this.id,
    required this.fullName,
    this.avatarUrl,
    this.rating,
    this.sessionsCount,
    this.matchScore,
    this.matchReason,
    this.responseTimeMinutes,
    this.specializations = const [],
    this.isClassTeacher = false,
  });

  final String id;
  final String fullName;
  final String? avatarUrl;
  final double? rating;
  final int? sessionsCount;
  final double? matchScore;
  final String? matchReason;
  final int? responseTimeMinutes;
  final List<String> specializations;
  final bool isClassTeacher;

  factory MentorCandidate.fromJson(Map<String, dynamic> json) {
    return MentorCandidate(
      id: readId(json, keys: ['id', 'mentorId', 'teacherId']),
      fullName: readString(
        json,
        'fullName',
        fallback: readString(
          json,
          'mentorName',
          fallback: readString(json, 'name'),
        ),
      ),
      avatarUrl: json['avatarUrl']?.toString(),
      rating: _toDouble(
        json['rating'] ?? json['averageRating'] ?? json['avgRating'],
      ),
      sessionsCount:
          (json['sessionsCount'] ??
                  json['sessions'] ??
                  json['completedMentorSessions'])
              as int?,
      matchScore: _toDouble(json['matchScore']),
      matchReason: json['matchReason']?.toString(),
      responseTimeMinutes:
          (json['responseTimeMinutes'] ?? json['avgResponseTimeMinutes'])
              as int?,
      specializations: parseStringList(
        json['specializations'] ?? json['specializationsList'],
      ),
      isClassTeacher:
          json['isClassTeacher'] == true || json['classTeacher'] == true,
    );
  }

  static double? _toDouble(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString());
  }
}

class EscalationOffer {
  const EscalationOffer({
    required this.questionEscalationId,
    required this.route,
    this.status = 'PENDING_OFFER',
    this.originalQuestion,
    this.aiAnswer,
    this.mentors = const [],
    this.activeChatRoomId,
  });

  final String questionEscalationId;
  final String route;
  final String status;
  final String? originalQuestion;
  final String? aiAnswer;
  final List<MentorCandidate> mentors;
  final String? activeChatRoomId;

  bool get hasActiveChat =>
      activeChatRoomId != null &&
      activeChatRoomId!.isNotEmpty &&
      status.toUpperCase() == 'IN_CHAT';

  EscalationOffer copyWith({
    String? status,
    String? activeChatRoomId,
    String? originalQuestion,
    String? aiAnswer,
  }) {
    return EscalationOffer(
      questionEscalationId: questionEscalationId,
      route: route,
      status: status ?? this.status,
      originalQuestion: originalQuestion ?? this.originalQuestion,
      aiAnswer: aiAnswer ?? this.aiAnswer,
      mentors: mentors,
      activeChatRoomId: activeChatRoomId ?? this.activeChatRoomId,
    );
  }

  factory EscalationOffer.fromJson(Map<String, dynamic> json) {
    final route = readString(
      json,
      'route',
      fallback: readString(
        json,
        'escalationRoute',
        fallback: 'MENTOR_MATCHING',
      ),
    );
    final isClassTeacherRoute = route == 'CLASS_TEACHER';

    final mentorsRaw =
        json['mentors'] ??
        json['candidates'] ??
        json['suggestedMentors'] ??
        json['mentorOffers'];
    List<MentorCandidate> mentors = parseList(
      mentorsRaw,
      MentorCandidate.fromJson,
    );

    if (mentors.isEmpty && json['classTeacher'] is Map) {
      mentors = [
        MentorCandidate.fromJson(
          Map<String, dynamic>.from(json['classTeacher'] as Map)
            ..['isClassTeacher'] = true
            ..['matchScore'] = 100,
        ),
      ];
    } else if (isClassTeacherRoute) {
      mentors = mentors
          .map(
            (m) => MentorCandidate(
              id: m.id,
              fullName: m.fullName,
              avatarUrl: m.avatarUrl,
              rating: m.rating,
              sessionsCount: m.sessionsCount,
              matchScore: m.matchScore ?? 100,
              matchReason: m.matchReason,
              responseTimeMinutes: m.responseTimeMinutes,
              specializations: m.specializations,
              isClassTeacher: true,
            ),
          )
          .toList();
    }

    return EscalationOffer(
      questionEscalationId: readId(
        json,
        keys: ['questionEscalationId', 'id', 'escalationId'],
      ),
      route: route,
      status: readString(json, 'status', fallback: 'PENDING_OFFER'),
      originalQuestion:
          json['originalQuestion']?.toString() ??
          json['question']?.toString() ??
          json['questionAsked']?.toString(),
      aiAnswer:
          json['aiAnswer']?.toString() ??
          json['answer']?.toString() ??
          json['aiResponse']?.toString(),
      mentors: mentors,
      activeChatRoomId: json['activeChatRoomId']?.toString() ??
          json['chatRoomId']?.toString(),
    );
  }
}

class EscalationHistoryItem {
  const EscalationHistoryItem({
    required this.id,
    required this.status,
    this.originalQuestion,
    this.mentorName,
    this.chatRoomId,
    this.createdAt,
  });

  final String id;
  final String status;
  final String? originalQuestion;
  final String? mentorName;
  final String? chatRoomId;
  final DateTime? createdAt;

  factory EscalationHistoryItem.fromJson(Map<String, dynamic> json) {
    return EscalationHistoryItem(
      id: readId(json, keys: ['id', 'questionEscalationId']),
      status: readString(json, 'status', fallback: 'PENDING_OFFER'),
      originalQuestion:
          json['originalQuestion']?.toString() ?? json['question']?.toString(),
      mentorName:
          json['mentorName']?.toString() ??
          json['assignedMentorName']?.toString() ??
          json['selectedMentorName']?.toString(),
      chatRoomId: json['chatRoomId']?.toString(),
      createdAt: parseDateTime(json['createdAt'] ?? json['updatedAt']),
    );
  }
}

class EscalationSelectResult {
  const EscalationSelectResult({required this.chatRoomId});

  final String chatRoomId;

  factory EscalationSelectResult.fromJson(Map<String, dynamic> json) {
    if (json['chatRoom'] is Map) {
      final room = Map<String, dynamic>.from(json['chatRoom'] as Map);
      return EscalationSelectResult(
        chatRoomId: readId(room, keys: ['chatRoomId', 'id', 'roomId']),
      );
    }
    return EscalationSelectResult(
      chatRoomId: readId(json, keys: ['chatRoomId', 'roomId', 'id']),
    );
  }
}
