import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../courses/application/courses_controller.dart';
import '../data/ai_tutor_repository.dart';
import '../data/course_learning_guide.dart';

final courseLearningGuideProvider = FutureProvider.autoDispose
    .family<CourseLearningGuide, String>((ref, courseIdOrCode) async {
      final courses = ref.watch(coursesControllerProvider).valueOrNull ?? [];
      final course = courses
          .where(
            (item) => item.id == courseIdOrCode || item.code == courseIdOrCode,
          )
          .firstOrNull;
      final apiCourseId = (course?.code ?? courseIdOrCode).trim();
      return ref
          .read(aiTutorRepositoryProvider)
          .fetchCourseLearningGuide(apiCourseId);
    });
