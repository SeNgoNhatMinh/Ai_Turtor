import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/router/routes.dart';
import '../../core/utils/ai_study_tips.dart';
import '../../core/utils/study_suggestion_prompt.dart'
    show isGuidedLessonPrompt;
import '../../shared/models/course.dart';
import '../../shared/models/improve_suggestion.dart';
import '../courses/application/courses_controller.dart';

/// Handoff "Học ngay" giống FE web: đổ prompt vào khung chat, không gửi API.
class StudyChatHandoff {
  const StudyChatHandoff({
    required this.prompt,
    this.suggestionText,
    this.improvePlanId,
    this.planItemId,
    this.interactionType,
    this.chapterKey,
    this.chapterTitle,
    this.sourceMaterialIds = const [],
    this.sourceChunkIds = const [],
  });

  final String prompt;
  final String? suggestionText;
  final String? improvePlanId;
  final String? planItemId;
  final String? interactionType;
  final String? chapterKey;
  final String? chapterTitle;
  final List<String> sourceMaterialIds;
  final List<String> sourceChunkIds;
}

class PendingTutorRequestContext {
  const PendingTutorRequestContext({
    this.prompt,
    this.interactionType,
    this.displayQuestion,
    this.improvePlanId,
    this.planItemId,
    this.clickedSuggestion,
    this.chapterKey,
    this.chapterTitle,
    this.sourceMaterialIds = const [],
    this.sourceChunkIds = const [],
  });

  final String? prompt;
  final String? interactionType;
  final String? displayQuestion;
  final String? improvePlanId;
  final String? planItemId;
  final String? clickedSuggestion;
  final String? chapterKey;
  final String? chapterTitle;
  final List<String> sourceMaterialIds;
  final List<String> sourceChunkIds;

  bool get hasImprovePlanGrounding {
    return (improvePlanId ?? '').trim().isNotEmpty &&
        (planItemId ?? '').trim().isNotEmpty;
  }
}

final studyChatHandoffProvider = StateProvider<StudyChatHandoff?>(
  (ref) => null,
);

final pendingTutorRequestContextProvider =
    StateProvider<PendingTutorRequestContext?>((ref) => null);

final quizTopicHandoffProvider = StateProvider<String?>((ref) => null);

const studyChatHandoffSnack =
    'Đã đưa gợi ý vào khung chat. Bạn có thể chỉnh sửa trước khi gửi.';

void selectCourseByRouteId(WidgetRef ref, String courseRouteId) {
  final courses =
      ref.read(coursesControllerProvider).valueOrNull ?? const <Course>[];
  for (final course in courses) {
    if (course.id == courseRouteId ||
        course.code == courseRouteId ||
        course.selectionKey == courseRouteId) {
      ref.read(selectedCourseProvider.notifier).state = course;
      return;
    }
  }
}

void queueStudyChatHandoff(
  WidgetRef ref,
  String suggestionText, {
  ImproveSuggestionItem? suggestion,
}) {
  final prompt = buildStudySuggestionPrompt(
    suggestionText,
    improvePlanId: suggestion?.improvePlanId,
    planItemId: suggestion?.planItemId,
  );
  if (prompt.isEmpty) return;
  ref.read(studyChatHandoffProvider.notifier).state = StudyChatHandoff(
    prompt: prompt,
    suggestionText: suggestionText,
    improvePlanId: suggestion?.improvePlanId,
    planItemId: suggestion?.planItemId,
    interactionType: suggestion?.interactionType,
    chapterKey: suggestion?.chapterKey,
    chapterTitle: suggestion?.chapterTitle,
    sourceMaterialIds: suggestion?.sourceMaterialIds ?? const [],
    sourceChunkIds: suggestion?.sourceChunkIds ?? const [],
  );
  final hasSourceProvenance = suggestion?.sourceMaterialIds.isNotEmpty == true;
  final guidedLesson = isGuidedLessonPrompt(prompt);
  if (suggestion?.hasImprovePlanGrounding == true ||
      hasSourceProvenance ||
      guidedLesson) {
    ref
        .read(pendingTutorRequestContextProvider.notifier)
        .state = PendingTutorRequestContext(
      prompt: prompt,
      interactionType: suggestion?.hasImprovePlanGrounding == true
          ? 'IMPROVE_PLAN_REVIEW'
          : suggestion?.interactionType ??
                (guidedLesson ? 'GUIDED_LESSON' : 'SOURCE_BACKED_STUDY_TIP'),
      displayQuestion: suggestionText,
      improvePlanId: suggestion?.improvePlanId,
      planItemId: suggestion?.planItemId,
      clickedSuggestion: suggestionText,
      chapterKey: suggestion?.chapterKey,
      chapterTitle: suggestion?.chapterTitle,
      sourceMaterialIds: suggestion?.sourceMaterialIds ?? const [],
      sourceChunkIds: suggestion?.sourceChunkIds ?? const [],
    );
  }
}

void openStudyChatFromSuggestion(
  BuildContext context,
  WidgetRef ref, {
  required String courseRouteId,
  required String suggestionText,
  ImproveSuggestionItem? suggestion,
}) {
  selectCourseByRouteId(ref, courseRouteId);
  queueStudyChatHandoff(ref, suggestionText, suggestion: suggestion);
  context.go(AppRoutes.studentTutor);
}

void openQuizFromSuggestion(
  BuildContext context,
  WidgetRef ref, {
  required String courseRouteId,
  required String suggestionText,
}) {
  selectCourseByRouteId(ref, courseRouteId);
  ref.read(quizTopicHandoffProvider.notifier).state = suggestionText.trim();
  context.push(AppRoutes.studentQuizForCourse(courseRouteId));
}
