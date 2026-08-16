import '../../core/utils/json_helpers.dart';

class Course {
  const Course({
    required this.id,
    required this.code,
    required this.name,
    this.className,
    this.classId,
    this.semester,
    this.status = 'ACTIVE',
  });

  final String id;
  final String code;
  final String name;
  final String? className;
  final String? classId;
  final String? semester;
  final String status;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Course && other.id == id;

  @override
  int get hashCode => id.hashCode;

  factory Course.fromJson(Map<String, dynamic> json) {
    return Course(
      id: readId(json, keys: ['courseId', 'id']),
      // CourseEnrollment không có courseCode → fallback courseId để không rỗng.
      code: readString(
        json,
        'code',
        fallback: readString(
          json,
          'courseCode',
          fallback: readString(json, 'courseId'),
        ),
      ),
      name: readString(json, 'name', fallback: readString(json, 'courseName')),
      className:
          json['className']?.toString() ?? json['classSectionName']?.toString(),
      classId:
          json['classId']?.toString() ?? json['classSectionId']?.toString(),
      semester:
          json['semester']?.toString() ?? json['semesterName']?.toString(),
      status: readString(json, 'status', fallback: 'ACTIVE'),
    );
  }
}
