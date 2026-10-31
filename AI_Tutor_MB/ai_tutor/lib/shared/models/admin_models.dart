import '../../core/utils/json_helpers.dart';

// ── Dashboard stats ───────────────────────────────────────────────

class AdminStats {
  const AdminStats({
    required this.users,
    required this.mentors,
    required this.escalations,
  });

  final int users;
  final int mentors;
  final int escalations;

  factory AdminStats.fromJson(Map<String, dynamic> json) {
    return AdminStats(
      users: (json['users'] as num?)?.toInt() ?? 0,
      mentors: (json['mentors'] as num?)?.toInt() ?? 0,
      escalations: (json['escalations'] as num?)?.toInt() ?? 0,
    );
  }
}

// ── User ─────────────────────────────────────────────────────────

class AdminUser {
  const AdminUser({
    required this.id,
    required this.email,
    required this.fullName,
    required this.role,
    this.phone,
    this.isActive = true,
    this.createdAt,
  });

  final String id;
  final String email;
  final String fullName;
  final String role;
  final String? phone;
  final bool isActive;
  final DateTime? createdAt;

  factory AdminUser.fromJson(Map<String, dynamic> json) {
    return AdminUser(
      id: readId(json, keys: ['id', 'userId']),
      email: readString(json, 'email'),
      fullName: readString(json, 'fullName'),
      role: readString(json, 'role', fallback: 'STUDENT'),
      phone: json['phone']?.toString(),
      isActive: json['isActive'] as bool? ?? true,
      createdAt: parseDateTime(json['createdAt']),
    );
  }
}

// ── Semester ──────────────────────────────────────────────────────

class Semester {
  const Semester({
    required this.id,
    required this.semesterCode,
    this.name,
    this.status = 'ACTIVE',
    this.startedAt,
    this.endedAt,
  });

  final String id;
  final String semesterCode;
  final String? name;
  final String status;
  final DateTime? startedAt;
  final DateTime? endedAt;

  factory Semester.fromJson(Map<String, dynamic> json) {
    return Semester(
      id: readId(json, keys: ['id']),
      semesterCode: readString(json, 'semesterCode'),
      name: json['name']?.toString(),
      status: readString(json, 'status', fallback: 'ACTIVE'),
      startedAt: parseDateTime(json['startedAt']),
      endedAt: parseDateTime(json['endedAt']),
    );
  }

  Map<String, dynamic> toJson() => {
        'semesterCode': semesterCode,
        if (name != null) 'name': name,
        'status': status,
      };
}

// ── AdminClassSection (all classes, unfiltered) ───────────────────

class AdminClass {
  const AdminClass({
    required this.courseId,
    required this.classId,
    required this.className,
    this.courseCode,
    this.courseName,
    this.teacherId,
    this.teacherName,
    this.studentCount = 0,
    this.status = 'ACTIVE',
  });

  final String courseId;
  final String classId;
  final String className;
  final String? courseCode;
  final String? courseName;
  final String? teacherId;
  final String? teacherName;
  final int studentCount;
  final String status;

  factory AdminClass.fromJson(Map<String, dynamic> json) {
    return AdminClass(
      courseId: readString(json, 'courseId'),
      classId: readString(json, 'classId'),
      className: readString(json, 'className', fallback: readString(json, 'name')),
      courseCode: json['courseCode']?.toString(),
      courseName: json['courseName']?.toString(),
      teacherId: json['teacherId']?.toString() ?? json['mentorId']?.toString(),
      teacherName: json['teacherName']?.toString() ?? json['mentorName']?.toString(),
      studentCount: (json['studentCount'] as num?)?.toInt() ?? 0,
      status: readString(json, 'status', fallback: 'ACTIVE'),
    );
  }
}

// ── Mentor (admin management) ─────────────────────────────────────

class AdminMentor {
  const AdminMentor({
    required this.id,
    required this.name,
    this.mentorCode,
    this.email,
    this.phone,
    this.department,
    this.city,
    this.isActive = true,
    this.verified = false,
    this.averageRating,
    this.completedMentorSessions = 0,
  });

  final String id;
  final String name;
  final String? mentorCode;
  final String? email;
  final String? phone;
  final String? department;
  final String? city;
  final bool isActive;
  final bool verified;
  final double? averageRating;
  final int completedMentorSessions;

  factory AdminMentor.fromJson(Map<String, dynamic> json) {
    return AdminMentor(
      id: readId(json, keys: ['id', 'mentorId']),
      name: readString(json, 'mentorName', fallback: readString(json, 'name')),
      mentorCode: json['mentorCode']?.toString(),
      email: json['email']?.toString(),
      phone: json['phone']?.toString(),
      department: json['department']?.toString(),
      city: json['city']?.toString(),
      isActive: json['isActive'] as bool? ?? true,
      verified: json['verified'] as bool? ?? false,
      averageRating: (json['averageRating'] as num?)?.toDouble(),
      completedMentorSessions:
          (json['completedMentorSessions'] as num?)?.toInt() ?? 0,
    );
  }
}

// ── Mentor escalation (admin oversight) ───────────────────────────

class AdminMentorEscalation {
  const AdminMentorEscalation({
    required this.id,
    this.userName,
    this.assignedMentorName,
    this.courseId,
    this.status = 'PENDING',
    this.originalQuestion,
    this.createdAt,
  });

  final String id;
  final String? userName;
  final String? assignedMentorName;
  final String? courseId;
  final String status;
  final String? originalQuestion;
  final DateTime? createdAt;

  factory AdminMentorEscalation.fromJson(Map<String, dynamic> json) {
    return AdminMentorEscalation(
      id: readId(json, keys: ['id']),
      userName: json['userName']?.toString(),
      assignedMentorName: json['assignedMentorName']?.toString(),
      courseId: json['courseId']?.toString(),
      status: readString(json, 'status', fallback: 'PENDING'),
      originalQuestion: json['originalQuestion']?.toString(),
      createdAt: parseDateTime(json['createdAt']),
    );
  }
}

