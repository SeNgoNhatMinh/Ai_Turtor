import 'package:ai_tutor/features/courses/application/courses_controller.dart';
import 'package:ai_tutor/shared/models/course.dart';
import 'package:flutter_test/flutter_test.dart';

Course _enrollment(String code, String classId, {String name = ''}) =>
    Course(id: code, code: code, name: name, classId: classId);

void main() {
  test('label is "CODE - Name", or only the code when the name is missing', () {
    expect(
      const Course(
        id: 'PRF192',
        code: 'PRF192',
        name: 'Foundations of Programming Using C',
      ).label,
      'PRF192 - Foundations of Programming Using C',
    );
    expect(const Course(id: 'PRJ301', code: 'PRJ301', name: '').label, 'PRJ301');
    expect(
      const Course(id: 'PRJ301', code: 'PRJ301', name: 'prj301').label,
      'PRJ301',
    );
  });

  test('fills missing names from the course catalog', () {
    final catalog = Course.fromJson({
      'courseId': 'PRJ301',
      'courseName': 'Java Web Application Development',
    });
    final named = withCatalogNames([
      _enrollment('PRJ301', 'SE1832'),
      _enrollment('PRJ301', 'SE1840', name: 'PRJ301'),
      _enrollment('CEA201', 'CEA201-01'),
    ], [catalog]);

    expect(named.map((c) => c.label), [
      'PRJ301 - Java Web Application Development',
      'PRJ301 - Java Web Application Development',
      'CEA201',
    ]);
    expect(named.first.classId, 'SE1832');
  });

  test('merges the same class written in different case, keeps other classes', () {
    final courses = dedupeEnrollments([
      _enrollment('PRJ301', 'SE1832'),
      _enrollment('PRJ301', 'SE1840', name: 'Java Web Application Development'),
      _enrollment('PRJ301', 'se1832', name: 'Java Web Application Development'),
      _enrollment('PRO192', '1833'),
      _enrollment('PRO192', 'SE1832'),
    ]);

    expect(courses.map((c) => '${c.code}|${c.classId}'), [
      'PRJ301|se1832',
      'PRJ301|SE1840',
      'PRO192|1833',
      'PRO192|SE1832',
    ]);
    // The copy carrying the course name wins the merge.
    expect(courses.first.displayName, 'Java Web Application Development');
  });
}
