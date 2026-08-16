import '../../core/utils/json_helpers.dart';

class QuizQuestion {
  const QuizQuestion({
    required this.questionId,
    required this.questionText,
    required this.type,
    this.options = const [],
    this.correctAnswer,
    this.explanation,
  });

  final String questionId;
  final String questionText;
  /// MULTIPLE_CHOICE or TRUE_FALSE
  final String type;
  final List<String> options;
  final String? correctAnswer;
  final String? explanation;

  /// Options shown to the student. Backend uses `Đúng`/`Sai` for TRUE_FALSE.
  List<String> get displayOptions {
    if (type == 'TRUE_FALSE') {
      if (options.length >= 2) return options;
      return const ['Đúng', 'Sai'];
    }
    return options;
  }

  factory QuizQuestion.fromJson(Map<String, dynamic> json) {
    return QuizQuestion(
      questionId: readId(json, keys: ['questionId', 'id']),
      questionText: readString(json, 'questionText', fallback: readString(json, 'question')),
      type: json['type']?.toString() ?? 'MULTIPLE_CHOICE',
      options: parseStringList(json['options']),
      correctAnswer: json['correctAnswer']?.toString(),
      explanation: json['explanation']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
    'questionId': questionId,
    'questionText': questionText,
    'type': type,
    'options': options,
    if (correctAnswer != null) 'correctAnswer': correctAnswer,
    if (explanation != null) 'explanation': explanation,
  };
}

class QuizAnswer {
  const QuizAnswer({
    required this.questionId,
    this.selectedAnswer,
    this.correct,
    this.correctAnswer,
    this.explanation,
  });

  final String questionId;
  final String? selectedAnswer;
  final bool? correct;
  final String? correctAnswer;
  final String? explanation;

  factory QuizAnswer.fromJson(Map<String, dynamic> json) {
    return QuizAnswer(
      questionId: json['questionId']?.toString() ?? '',
      selectedAnswer: json['selectedAnswer']?.toString(),
      correct: json['correct'] as bool?,
      correctAnswer: json['correctAnswer']?.toString(),
      explanation: json['explanation']?.toString(),
    );
  }
}

class QuizSession {
  const QuizSession({
    required this.id,
    required this.studentId,
    required this.courseId,
    required this.questions,
    this.classId,
    this.topic,
    this.assignmentId,
    this.quizType = 'SELF_PRACTICE',
    this.status = 'GENERATED',
    this.score,
    this.maxScore,
    this.percentage,
    this.teacherReviewStatus,
    this.teacherReviewedScore,
    this.teacherFeedback,
    this.answers = const [],
    this.createdAt,
    this.submittedAt,
  });

  final String id;
  final String studentId;
  final String courseId;
  final String? classId;
  final String? topic;
  final String? assignmentId;
  /// SELF_PRACTICE or ASSIGNED
  final String quizType;
  /// GENERATED or SUBMITTED
  final String status;
  final int? score;
  final int? maxScore;
  final double? percentage;
  final String? teacherReviewStatus;
  final int? teacherReviewedScore;
  final String? teacherFeedback;
  final List<QuizQuestion> questions;
  final List<QuizAnswer> answers;
  final DateTime? createdAt;
  final DateTime? submittedAt;

  bool get isSubmitted => status == 'SUBMITTED';

  factory QuizSession.fromJson(Map<String, dynamic> json) {
    return QuizSession(
      id: readId(json, keys: ['id', 'quizSessionId', 'sessionId']),
      studentId: json['studentId']?.toString() ?? '',
      courseId: json['courseId']?.toString() ?? '',
      classId: json['classId']?.toString(),
      topic: json['topic']?.toString() ?? json['suggestionText']?.toString(),
      assignmentId: json['assignmentId']?.toString(),
      quizType: json['quizType']?.toString() ?? 'SELF_PRACTICE',
      status: json['status']?.toString() ?? 'GENERATED',
      score: (json['score'] as num?)?.toInt(),
      maxScore: (json['maxScore'] as num?)?.toInt(),
      percentage: (json['percentage'] as num?)?.toDouble(),
      teacherReviewStatus: json['teacherReviewStatus']?.toString(),
      teacherReviewedScore: (json['teacherReviewedScore'] as num?)?.toInt(),
      teacherFeedback: json['teacherFeedback']?.toString(),
      questions: parseList(json['questions'], QuizQuestion.fromJson),
      answers: parseList(json['answers'], QuizAnswer.fromJson),
      createdAt: parseDateTime(json['createdAt']),
      submittedAt: parseDateTime(json['submittedAt']),
    );
  }
}

class QuizAssignment {
  const QuizAssignment({
    required this.id,
    required this.teacherId,
    required this.courseId,
    required this.title,
    required this.status,
    required this.questions,
    this.classId,
    this.topic,
    this.targetType,
    this.targetStudentIds = const [],
    this.createdAt,
    this.publishedAt,
  });

  final String id;
  final String teacherId;
  final String courseId;
  final String? classId;
  final String title;
  final String? topic;
  /// DRAFT, PUBLISHED, CLOSED
  final String status;
  /// CLASS or SELECTED_STUDENTS
  final String? targetType;
  final List<String> targetStudentIds;
  final List<QuizQuestion> questions;
  final DateTime? createdAt;
  final DateTime? publishedAt;

  bool get isDraft => status == 'DRAFT';
  bool get isPublished => status == 'PUBLISHED';

  factory QuizAssignment.fromJson(Map<String, dynamic> json) {
    return QuizAssignment(
      id: readId(json, keys: ['id', 'assignmentId']),
      teacherId: json['teacherId']?.toString() ?? '',
      courseId: json['courseId']?.toString() ?? '',
      classId: json['classId']?.toString(),
      title: readString(json, 'title', fallback: 'Quiz'),
      topic: json['topic']?.toString() ?? json['suggestionText']?.toString(),
      status: json['status']?.toString() ?? 'DRAFT',
      targetType: json['targetType']?.toString(),
      targetStudentIds: parseStringList(json['targetStudentIds']),
      questions: parseList(json['questions'], QuizQuestion.fromJson),
      createdAt: parseDateTime(json['createdAt']),
      publishedAt: parseDateTime(json['publishedAt']),
    );
  }
}
