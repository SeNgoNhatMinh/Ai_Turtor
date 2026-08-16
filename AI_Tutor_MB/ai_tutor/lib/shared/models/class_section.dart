import '../../core/utils/json_helpers.dart';

class ClassSection {
  const ClassSection({
    required this.id,
    required this.courseId,
    required this.name,
    this.courseName,
    this.courseCode,
    this.semester,
    this.status = 'ACTIVE',
    this.studentCount,
  });

  final String id;
  final String courseId;
  final String name;
  final String? courseName;
  final String? courseCode;
  final String? semester;
  final String status;
  final int? studentCount;

  factory ClassSection.fromJson(Map<String, dynamic> json) {
    return ClassSection(
      id: readId(json, keys: ['id', 'classId', 'classSectionId']),
      courseId: readId(json, keys: ['courseId']),
      name: readString(
        json,
        'name',
        fallback: readString(
          json,
          'className',
          fallback: readString(json, 'classSectionName'),
        ),
      ),
      courseName: json['courseName']?.toString(),
      courseCode: json['courseCode']?.toString(),
      semester:
          json['semester']?.toString() ?? json['semesterName']?.toString(),
      status: readString(json, 'status', fallback: 'ACTIVE'),
      studentCount: (json['studentCount'] ?? json['enrollmentCount'] as num?)
          ?.toInt(),
    );
  }
}

class RosterStudent {
  const RosterStudent({
    required this.id,
    required this.fullName,
    this.email,
    this.weakTopics = const [],
  });

  final String id;
  final String fullName;
  final String? email;
  final List<String> weakTopics;

  factory RosterStudent.fromJson(Map<String, dynamic> json) {
    return RosterStudent(
      id: readId(json, keys: ['id', 'studentId', 'userId']),
      fullName: readString(
        json,
        'fullName',
        fallback: readString(json, 'name'),
      ),
      email: json['email']?.toString(),
      weakTopics: parseStringList(json['weakTopics']),
    );
  }
}
