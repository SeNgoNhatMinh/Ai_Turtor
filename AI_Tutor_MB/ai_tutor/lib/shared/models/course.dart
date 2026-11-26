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
      other is Course &&
          other.id == id &&
          (other.classId ?? '') == (classId ?? '');

  @override
  int get hashCode => Object.hash(id, classId ?? '');

  /// Khóa duy nhất cho dropdown / selection (một môn có thể học nhiều lớp).
  String get selectionKey => '$id|${classId ?? ''}';

  /// Tên môn thật; rỗng khi backend chỉ trả lại mã môn.
  String get displayName {
    final value = name.trim();
    if (value.isEmpty || value.toUpperCase() == code.trim().toUpperCase()) {
      return '';
    }
    return value;
  }

  /// "PRF192 - Foundations of Programming Using C", hoặc chỉ mã môn.
  String get label => displayName.isEmpty ? code : '$code - $displayName';

  /// Tên lớp hiển thị (className, nếu không có thì mã lớp).
  String get classLabel {
    final value = (className ?? '').trim();
    return value.isNotEmpty ? value : (classId ?? '').trim();
  }

  Course copyWith({String? name}) {
    return Course(
      id: id,
      code: code,
      name: name ?? this.name,
      className: className,
      classId: classId,
      semester: semester,
      status: status,
    );
  }

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
      // Khớp web `getClassCodeValue`: backend authorization nhận mã lớp
      // enrollment trước, rồi mới fallback sang id của class section.
      classId:
          json['classCode']?.toString() ??
          (json['classSection'] is Map
              ? (json['classSection'] as Map)['classCode']?.toString()
              : null) ??
          json['classSectionCode']?.toString() ??
          json['classId']?.toString() ??
          json['sectionId']?.toString() ??
          json['classSectionId']?.toString(),
      semester:
          json['semester']?.toString() ?? json['semesterName']?.toString(),
      status: readString(json, 'status', fallback: 'ACTIVE'),
    );
  }
}
