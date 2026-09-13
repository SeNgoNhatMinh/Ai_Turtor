import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/realtime_event.dart';
import '../../../core/network/realtime_providers.dart';
import '../../../shared/models/ai_conversation.dart';
import '../../../shared/models/course.dart';
import '../../auth/application/auth_controller.dart';
import '../../courses/application/courses_controller.dart';
import '../data/ai_tutor_repository.dart';
import '../data/tutor_session.dart';

class ActiveTutorSessionSnapshot {
  const ActiveTutorSessionSnapshot({
    this.session,
    this.summary,
    this.loading = false,
  });

  final TutorSessionState? session;
  final TutorSessionSummaryInfo? summary;
  final bool loading;

  ActiveTutorSessionSnapshot copyWith({
    TutorSessionState? session,
    TutorSessionSummaryInfo? summary,
    bool? loading,
    bool clearSummary = false,
  }) {
    return ActiveTutorSessionSnapshot(
      session: session ?? this.session,
      summary: clearSummary ? null : (summary ?? this.summary),
      loading: loading ?? this.loading,
    );
  }
}

class TutorSessionController extends Notifier<ActiveTutorSessionSnapshot> {
  @override
  ActiveTutorSessionSnapshot build() {
    ref.listen(realtimeEventsProvider, (_, next) {
      next.whenData(_onRealtime);
    });
    return const ActiveTutorSessionSnapshot();
  }

  Course? get _activeCourse {
    return ref.read(selectedCourseProvider) ??
        ref.read(coursesControllerProvider).valueOrNull?.firstOrNull;
  }

  void applyOpened(TutorSessionOpenResult? opened) {
    if (opened?.session == null) return;
    mergeSession(opened!.session!);
    if (opened.session!.isActive) {
      state = state.copyWith(clearSummary: true);
    }
  }

  void mergeSession(TutorSessionState session) {
    if (session.id.isEmpty) return;
    final current = state.session;
    state = state.copyWith(
      session: current == null ? session : current.merge(session),
    );
  }

  void applyAnswer(AiAnswer answer) {
    final current = state.session;
    if (current == null) return;
    final topics = answer.suggestedTopics;
    final phase = (answer.sessionPhase ?? '').trim();
    if (phase.isEmpty && topics.isEmpty) return;
    state = state.copyWith(
      session: current.copyWith(
        phase: phase.isEmpty ? current.phase : phase,
        suggestedTopics: topics.isEmpty ? current.suggestedTopics : topics,
      ),
    );
  }

  Future<void> closeIfDailyComplete(int remaining) async {
    final session = state.session;
    if (session == null || session.id.isEmpty || remaining > 0) return;
    if (session.isCompleted) return;
    try {
      final summary = await ref
          .read(aiTutorRepositoryProvider)
          .closeTutorSession(session.id);
      state = state.copyWith(
        session: session.copyWith(
          status: 'COMPLETED',
          phase: 'CLOSED',
          summaryId: summary.id.isEmpty ? session.summaryId : summary.id,
        ),
        summary: summary,
      );
    } catch (_) {}
  }

  Future<TutorSessionOpenResult?> startNext() async {
    if (state.loading) return null;
    final userId = ref.read(currentUserIdProvider);
    final course = _activeCourse;
    final courseId = (course?.code ?? '').trim();
    if (userId.isEmpty || courseId.isEmpty) return null;
    state = state.copyWith(loading: true);
    try {
      final opened = await ref
          .read(aiTutorRepositoryProvider)
          .openTutorSession(
            studentId: userId,
            courseId: courseId,
            classId: resolveTutorClassId(
              classId: course?.classId,
              className: course?.className,
            ),
          );
      applyOpened(opened);
      return opened;
    } catch (_) {
      return null;
    } finally {
      state = state.copyWith(loading: false);
    }
  }

  void _onRealtime(RealtimeEvent event) {
    final type = event.type.toUpperCase();
    if (type != 'TUTOR_SESSION_OPENED' && type != 'TUTOR_SESSION_UPDATED') {
      return;
    }
    final payload = event.data;
    final rawSession = payload['session'];
    if (rawSession is! Map) return;
    final session = TutorSessionState.fromJson(
      Map<String, dynamic>.from(rawSession),
    );
    if (session.id.isEmpty) return;

    final userId = ref.read(currentUserIdProvider);
    final course = _activeCourse;
    final courseKeys = <String>{
      if ((course?.id ?? '').trim().isNotEmpty) course!.id.trim().toUpperCase(),
      if ((course?.code ?? '').trim().isNotEmpty)
        course!.code.trim().toUpperCase(),
    };
    final eventCourse =
        (session.courseId.isNotEmpty
                ? session.courseId
                : (payload['courseId'] ?? '').toString())
            .trim()
            .toUpperCase();
    if (session.studentId.isNotEmpty &&
        userId.isNotEmpty &&
        session.studentId != userId) {
      return;
    }
    if (eventCourse.isNotEmpty &&
        courseKeys.isNotEmpty &&
        !courseKeys.contains(eventCourse)) {
      return;
    }

    mergeSession(session);
    if (type != 'TUTOR_SESSION_OPENED') return;

    final conversationId = (payload['conversationId'] ?? '').toString().trim();
    final opening = parseOpeningMessage(payload['openingMessage']);
    if (conversationId.isEmpty && opening == null) return;
    final fallbackIds = state.session?.conversationIds ?? const <String>[];
    ref
        .read(tutorOpeningHandoffProvider.notifier)
        .state = TutorSessionOpenResult(
      conversationId: conversationId.isEmpty
          ? (fallbackIds.isEmpty ? '' : fallbackIds.last)
          : conversationId,
      openingMessage: opening,
      resumed: true,
      session: session,
    );
  }
}

final tutorSessionControllerProvider =
    NotifierProvider<TutorSessionController, ActiveTutorSessionSnapshot>(
      TutorSessionController.new,
    );

final tutorOpeningHandoffProvider = StateProvider<TutorSessionOpenResult?>(
  (ref) => null,
);

final chatRevealMessageIdProvider = StateProvider.autoDispose
    .family<String?, String>((ref, conversationId) => null);
