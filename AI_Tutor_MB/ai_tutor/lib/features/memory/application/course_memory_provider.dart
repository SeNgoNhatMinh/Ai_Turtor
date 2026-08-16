import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/models/course.dart';
import '../../../shared/models/improve_plan.dart';
import '../../auth/application/auth_controller.dart';
import '../../courses/application/courses_controller.dart';
import '../data/improve_plan_repository.dart';

/// Mã môn học dùng cho API backend (`PRO192`), không phải Mongo `_id`.
String resolveCourseApiId(Ref ref, String courseRouteId) {
  final courses = ref.read(coursesControllerProvider).valueOrNull ?? [];
  for (final course in courses) {
    if (course.id == courseRouteId || course.code == courseRouteId) {
      return course.code.isNotEmpty ? course.code : course.id;
    }
  }
  return courseRouteId;
}

Course? findCourseByRouteId(Ref ref, String courseRouteId) {
  final courses = ref.read(coursesControllerProvider).valueOrNull ?? [];
  for (final course in courses) {
    if (course.id == courseRouteId || course.code == courseRouteId) {
      return course;
    }
  }
  return null;
}

/// Route id (`course.id`) dùng cho provider family — từ id hoặc mã môn.
String resolveCourseRouteId(List<Course> courses, String courseIdOrCode) {
  for (final course in courses) {
    if (course.id == courseIdOrCode || course.code == courseIdOrCode) {
      return course.id;
    }
  }
  return courseIdOrCode;
}

/// Memory theo môn — dùng trên Course screen và Improve Plan.
final courseMemoryProvider = FutureProvider.autoDispose
    .family<StudentMemory, String>((ref, courseRouteId) async {
      final studentId = ref.watch(currentUserIdProvider);
      final courseId = resolveCourseApiId(ref, courseRouteId);
      return ref
          .read(improvePlanRepositoryProvider)
          .fetchMemory(studentId: studentId, courseId: courseId);
    });

/// Gộp chủ đề hiển thị trên Improve Plan: improveSuggestions + weakTopics + plan.
List<String> mergeImproveTopics({
  required StudentMemory memory,
  required List<String> planWeakTopics,
}) {
  final seen = <String>{};
  final merged = <String>[];

  void addAll(Iterable<String> items) {
    for (final raw in items) {
      final item = raw.trim();
      if (item.isEmpty) continue;
      final key = item.toLowerCase();
      if (seen.add(key)) merged.add(item);
    }
  }

  addAll(memory.improveSuggestions);
  addAll(planWeakTopics);
  addAll(memory.weakTopics);
  return merged;
}
