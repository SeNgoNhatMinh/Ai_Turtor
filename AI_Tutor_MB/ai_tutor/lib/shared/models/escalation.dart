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
    this.online = false,
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
  final bool online;

  MentorCandidate copyWith({bool? online}) {
    return MentorCandidate(
      id: id,
      fullName: fullName,
      avatarUrl: avatarUrl,
      rating: rating,
      sessionsCount: sessionsCount,
      matchScore: matchScore,
      matchReason: matchReason,
      responseTimeMinutes: responseTimeMinutes,
      specializations: specializations,
      isClassTeacher: isClassTeacher,
      online: online ?? this.online,
    );
  }

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
      online: json['online'] == true,
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
    List<MentorCandidate>? mentors,
  }) {
    return EscalationOffer(
      questionEscalationId: questionEscalationId,
      route: route,
      status: status ?? this.status,
      originalQuestion: originalQuestion ?? this.originalQuestion,
      aiAnswer: aiAnswer ?? this.aiAnswer,
      mentors: mentors ?? this.mentors,
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
              online: m.online,
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
      activeChatRoomId:
          json['activeChatRoomId']?.toString() ??
          json['chatRoomId']?.toString(),
    );
  }
}

class EscalationHistoryItem {
  const EscalationHistoryItem({
    required this.id,
    required this.status,
    this.studentVisibleStatus,
    this.originalQuestion,
    this.questionPreview,
    this.conversationId,
    this.courseId,
    this.classId,
    this.mentorName,
    this.mentorAnswer,
    this.aiResponse,
    this.chatRoomId,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String status;
  final String? studentVisibleStatus;
  final String? originalQuestion;
  final String? questionPreview;
  final String? conversationId;
  final String? courseId;
  final String? classId;
  final String? mentorName;
  final String? mentorAnswer;
  final String? aiResponse;
  final String? chatRoomId;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  EscalationHistoryItem merge(EscalationHistoryItem? other) {
    if (other == null) return this;
    String? pick(String? preferred, String? fallback) {
      final value = preferred?.trim();
      if (value != null && value.isNotEmpty) return preferred;
      return fallback;
    }

    return EscalationHistoryItem(
      id: id.isNotEmpty ? id : other.id,
      status: status.isNotEmpty ? status : other.status,
      studentVisibleStatus: pick(
        studentVisibleStatus,
        other.studentVisibleStatus,
      ),
      originalQuestion: pick(originalQuestion, other.originalQuestion),
      questionPreview: pick(questionPreview, other.questionPreview),
      conversationId: pick(conversationId, other.conversationId),
      courseId: pick(courseId, other.courseId),
      classId: pick(classId, other.classId),
      mentorName: pick(mentorName, other.mentorName),
      mentorAnswer: pick(mentorAnswer, other.mentorAnswer),
      aiResponse: pick(aiResponse, other.aiResponse),
      chatRoomId: pick(chatRoomId, other.chatRoomId),
      createdAt: createdAt ?? other.createdAt,
      updatedAt: updatedAt ?? other.updatedAt,
    );
  }

  factory EscalationHistoryItem.fromJson(Map<String, dynamic> json) {
    final mentorAnswer =
        json['mentorAnswer']?.toString() ??
        json['teacherAnswer']?.toString() ??
        json['response']?.toString() ??
        json['mentorResponse']?.toString();
    return EscalationHistoryItem(
      id: readId(json, keys: ['id', 'questionEscalationId']),
      status: readString(json, 'status', fallback: 'PENDING_OFFER'),
      studentVisibleStatus: json['studentVisibleStatus']?.toString(),
      originalQuestion:
          json['originalQuestion']?.toString() ??
          json['question']?.toString() ??
          json['questionPreview']?.toString(),
      questionPreview:
          json['questionPreview']?.toString() ??
          json['question']?.toString() ??
          json['originalQuestion']?.toString(),
      conversationId: json['conversationId']?.toString(),
      courseId: json['courseId']?.toString(),
      classId: json['classId']?.toString(),
      mentorName:
          json['mentorName']?.toString() ??
          json['assignedMentorName']?.toString() ??
          json['selectedMentorName']?.toString() ??
          json['teacherName']?.toString(),
      mentorAnswer: mentorAnswer,
      aiResponse:
          json['aiResponse']?.toString() ??
          json['aiAnswer']?.toString() ??
          json['answerSnapshot']?.toString() ??
          json['aiSnapshot']?.toString(),
      chatRoomId: json['chatRoomId']?.toString(),
      createdAt: parseDateTime(json['createdAt']),
      updatedAt: parseDateTime(json['updatedAt'] ?? json['createdAt']),
    );
  }

  factory EscalationHistoryItem.fromDetailJson(Map<String, dynamic> json) {
    Map<String, dynamic> detail = {};
    for (final key in ['questionEscalation', 'escalation']) {
      final value = json[key];
      if (value is Map) {
        detail = Map<String, dynamic>.from(value);
        break;
      }
    }
    if (detail.isEmpty) {
      detail = Map<String, dynamic>.from(json);
    }

    String? mentorAnswer = detail['mentorAnswer']?.toString();
    final latestAnswer = json['latestMentorAnswer'];
    if (latestAnswer is String && latestAnswer.trim().isNotEmpty) {
      mentorAnswer = latestAnswer;
    } else if (latestAnswer is Map) {
      mentorAnswer =
          latestAnswer['answer']?.toString() ??
          latestAnswer['content']?.toString() ??
          latestAnswer['mentorAnswer']?.toString() ??
          mentorAnswer;
    }

    return EscalationHistoryItem.fromJson({
      ...detail,
      if (json['studentVisibleStatus'] != null)
        'studentVisibleStatus': json['studentVisibleStatus'],
      if (mentorAnswer != null && mentorAnswer.trim().isNotEmpty)
        'mentorAnswer': mentorAnswer,
    });
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
