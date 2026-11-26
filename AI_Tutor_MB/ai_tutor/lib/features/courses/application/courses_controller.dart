import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/models/course.dart';
import '../../auth/application/auth_controller.dart';
import '../data/courses_repository.dart';

class CoursesController extends AutoDisposeAsyncNotifier<List<Course>> {
  @override
  Future<List<Course>> build() async {
    final studentId = ref.watch(currentUserIdProvider);
    final repository = ref.read(coursesRepositoryProvider);
    final enrollments = await repository.fetchStudentCourses(studentId);
    if (enrollments.every((course) => course.displayName.isNotEmpty)) {
      return dedupeEnrollments(enrollments);
    }
    var catalog = const <Course>[];
    try {
      catalog = await repository.fetchCourseCatalog();
    } catch (error) {
      // Names are cosmetic; the enrollment list must still load.
      debugPrint('Course catalog unavailable: $error');
    }
    return dedupeEnrollments(withCatalogNames(enrollments, catalog));
  }
}

String _courseKey(String value) => value.trim().toUpperCase();

/// Fills missing course names ("PRJ301 —") from the course catalog.
@visibleForTesting
List<Course> withCatalogNames(List<Course> enrollments, List<Course> catalog) {
  final names = <String, String>{};
  for (final course in catalog) {
    final name = course.displayName;
    if (name.isEmpty) continue;
    names.putIfAbsent(_courseKey(course.code), () => name);
    names.putIfAbsent(_courseKey(course.id), () => name);
  }
  return [
    for (final course in enrollments)
      course.displayName.isNotEmpty
          ? course
          : course.copyWith(
              name:
                  names[_courseKey(course.code)] ??
                  names[_courseKey(course.id)] ??
                  course.name,
            ),
  ];
}

/// One row per course + class. "SE1832" and "se1832" are the same class;
/// the copy that carries a course name wins.
@visibleForTesting
List<Course> dedupeEnrollments(List<Course> courses) {
  final byKey = <String, int>{};
  final result = <Course>[];
  for (final course in courses) {
    final key =
        '${_courseKey(course.code)}|${_courseKey(course.classId ?? course.className ?? '')}';
    final existing = byKey[key];
    if (existing == null) {
      byKey[key] = result.length;
      result.add(course);
    } else if (result[existing].displayName.isEmpty &&
        course.displayName.isNotEmpty) {
      result[existing] = course;
    }
  }
  return result;
}

final coursesControllerProvider =
    AutoDisposeAsyncNotifierProvider<CoursesController, List<Course>>(
      CoursesController.new,
    );

final selectedCourseProvider = StateProvider<Course?>((ref) => null);
