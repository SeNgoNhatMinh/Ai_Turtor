import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/utils/ai_chat_content.dart';
import '../../../core/utils/reviewed_message_ids.dart';
import '../data/chat_improve_suggestions.dart';
import '../../../shared/models/ai_conversation.dart';
import '../../../shared/models/course.dart';
import '../../../shared/models/improve_suggestion.dart';
import '../../auth/application/auth_controller.dart';
import '../../courses/application/courses_controller.dart';
import '../../escalation/data/escalation_repository.dart';
import '../../memory/data/improve_plan_repository.dart';
import '../../student/student_route_handoff.dart';
import '../data/ai_tutor_repository.dart';
import '../data/daily_question_quota.dart';
import '../data/tutor_session.dart';
import '../data/understanding_check_store.dart';
import 'daily_question_quota_controller.dart';
import 'tutor_session_controller.dart';

export 'tutor_session_controller.dart';

String? _correctnessLevelForReview({
  required int rating,
  required bool accurate,
}) {
  if (rating >= 5 || accurate) return 'HIGH';
  if (rating <= 1) return 'INCORRECT';
  if (rating <= 3) return 'PARTIAL';
  return 'MEDIUM';
}

Course? _activeCourseForChat(Ref ref) {
  final selected = ref.read(selectedCourseProvider);
  final courses = ref.read(coursesControllerProvider).valueOrNull;
  return selected ?? courses?.firstOrNull;
}

Future<TutorSessionOpenResult?> _openTutorSessionBestEffort({
  required AiTutorRepository repo,
  required String studentId,
  Course? course,
  String? courseId,
  String? classId,
}) async {
  for (final attempt in tutorSessionOpenAttempts(
    course: course,
    courseId: courseId,
    classId: classId,
  )) {
    try {
      final opened = await repo.openTutorSession(
        studentId: studentId,
        courseId: attempt.$1,
        classId: attempt.$2,
      );
      if (opened.openingMessage != null ||
          opened.conversationId.isNotEmpty ||
          opened.session != null) {
        return opened;
      }
    } catch (_) {}
  }
  return null;
}

Future<List<String>> _openingLessonStartersForCourse({
  required AiTutorRepository repo,
  Course? course,
  String? courseCode,
}) async {
  final keys = <String>{
    if ((course?.id ?? '').trim().isNotEmpty) course!.id.trim(),
    if ((course?.code ?? '').trim().isNotEmpty) course!.code.trim(),
    if ((courseCode ?? '').trim().isNotEmpty) courseCode!.trim(),
  };
  for (final key in keys) {
    final titles = await repo.fetchSuggestedChapterTitles(key);
    final picked = pickOpeningLessonStarters(titles);
    if (picked.isNotEmpty) return picked;
  }
  return const [];
}

Future<({AiMessage opening, TutorSessionOpenResult? session})>
_resolveFirstVisitOpeningBundle({
  required AiTutorRepository repo,
  required String userId,
  Course? course,
  String? courseCode,
  String? classId,
}) async {
  final opened = await _openTutorSessionBestEffort(
    repo: repo,
    studentId: userId,
    course: course,
    courseId: courseCode,
    classId: classId,
  );
  if (opened?.openingMessage != null) {
    return (opening: opened!.openingMessage!, session: opened);
  }
  if (opened != null && opened.conversationId.isNotEmpty) {
    try {
      final persisted = await repo.fetchMessages(
        conversationId: opened.conversationId,
        userId: userId,
      );
      for (final message in persisted) {
        if (!message.isUser && isWelcomeTutorTurn(message)) {
          return (opening: message, session: opened);
        }
      }
      for (final message in persisted) {
        if (!message.isUser) {
          return (opening: message, session: opened);
        }
      }
    } catch (_) {}
  }

  final starters = await _openingLessonStartersForCourse(
    repo: repo,
    course: course,
    courseCode: courseCode,
  );
  final opening = buildCourseWelcomeOpening(
    courseLabel: (courseCode ?? '').trim().isNotEmpty
        ? courseCode!.trim()
        : (course?.code ?? course?.id ?? 'môn học'),
    courseName: course?.name,
    lessonStarters: starters,
  );
  return (opening: opening, session: opened);
}

Future<List<AiConversation>> _historyForCourse({
  required AiTutorRepository repo,
  required String userId,
  String? courseId,
  String? courseCode,
}) async {
  final keys = <String>{
    if ((courseCode ?? '').trim().isNotEmpty) courseCode!.trim(),
    if ((courseId ?? '').trim().isNotEmpty) courseId!.trim(),
  };
  if (keys.isEmpty) return const [];
  final seen = <String>{};
  final merged = <AiConversation>[];
  for (final key in keys) {
    final items = await repo.fetchConversations(userId, courseId: key);
    for (final item in items) {
      if (seen.add(item.id)) merged.add(item);
    }
  }
  return merged;
}

/// Các suggestion đã bấm "Học ngay" trong một cuộc trò chuyện.
final consumedSuggestionKeysProvider = StateProvider.autoDispose
    .family<Set<String>, String>((ref, conversationId) => {});

/// Các tin nhắn AI đã được học sinh review trong phiên hiện tại.
final reviewedMessageIdsProvider = StateProvider.autoDispose
    .family<Set<String>, String>((ref, conversationId) => {});

/// `true` khi backend trả `DAILY_QUESTION_LIMIT_REACHED` (BE mới).
final studentDailyQuestionBlockedProvider = StateProvider<bool>((ref) => false);

/// Thời điểm hạn mức ngày làm mới, nếu backend trả `resetAt`.
final studentDailyQuestionResetAtProvider = StateProvider<DateTime?>(
  (ref) => null,
);

class ChatTurnLimitNotice {
  const ChatTurnLimitNotice({
    required this.previousSessionId,
    required this.currentSessionId,
    this.message =
        'Cuộc trò chuyện đã đủ 10 câu hỏi. AI Tutor đã tạo cuộc trò chuyện mới để giữ ngữ cảnh tập trung.',
  });

  final String previousSessionId;
  final String currentSessionId;
  final String message;
}

/// Banner rollover khi backend tạo conversation mới vì đủ 10 câu.
final chatTurnLimitNoticeProvider = StateProvider<ChatTurnLimitNotice?>(
  (ref) => null,
);

class ConversationsController
    extends AutoDisposeAsyncNotifier<List<AiConversation>> {
  @override
  Future<List<AiConversation>> build() async {
    final userId = ref.watch(currentUserIdProvider);
    final course = ref.watch(selectedCourseProvider);
    final courses = ref.watch(coursesControllerProvider).valueOrNull;
    final activeCourse = course ?? courses?.firstOrNull;
    return ref
        .read(aiTutorRepositoryProvider)
        .fetchConversations(userId, courseId: activeCourse?.id);
  }

  Future<AiConversation> createNew({String? courseId, String? classId}) async {
    final userId = ref.read(currentUserIdProvider);
    final active = _activeCourseForChat(ref);
    final conversation = await ref
        .read(aiTutorRepositoryProvider)
        .createConversation(
          userId,
          courseId: courseId ?? active?.id,
          classId: classId ?? active?.classId,
        );
    ref.invalidateSelf();
    return conversation;
  }

  Future<AiConversation> openTutorSessionOrCreate({
    String? courseId,
    String? classId,
  }) async {
    final userId = ref.read(currentUserIdProvider);
    final active = _activeCourseForChat(ref);
    final resolvedCourseId = (courseId ?? active?.code ?? '').trim();
    final resolvedClassId = resolveTutorClassId(
      classId: classId ?? active?.classId,
      className: active?.className,
    );
    if (resolvedCourseId.isEmpty) {
      return createNew(
        courseId: courseId,
        classId: resolvedClassId.isEmpty ? classId : resolvedClassId,
      );
    }

    final repo = ref.read(aiTutorRepositoryProvider);
    final bundle = await _resolveFirstVisitOpeningBundle(
      repo: repo,
      userId: userId,
      course: active,
      courseCode: resolvedCourseId,
      classId: resolvedClassId,
    );
    final opened = bundle.session;
    ref.read(tutorSessionControllerProvider.notifier).applyOpened(opened);
    if (opened == null || opened.conversationId.isEmpty) {
      final created = await createNew(
        courseId: active?.id ?? resolvedCourseId,
        classId: resolvedClassId,
      );
      ref
          .read(tutorOpeningHandoffProvider.notifier)
          .state = TutorSessionOpenResult(
        conversationId: created.id,
        openingMessage: bundle.opening,
        session: opened?.session,
      );
      return created;
    }
    ref
        .read(tutorOpeningHandoffProvider.notifier)
        .state = TutorSessionOpenResult(
      conversationId: opened.conversationId,
      openingMessage: bundle.opening,
      resumed: opened.resumed,
      session: opened.session,
    );
    ref.invalidateSelf();
    return AiConversation(
      id: opened.conversationId,
      title: 'Buổi học cùng AI Tutor',
      courseId: resolvedCourseId,
      classId: resolvedClassId,
    );
  }

  Future<void> deleteConversation(String id) async {
    final userId = ref.read(currentUserIdProvider);
    await ref.read(aiTutorRepositoryProvider).deleteConversation(id, userId);
    ref.invalidateSelf();
  }

  Future<void> renameConversation(String id, String title) async {
    final userId = ref.read(currentUserIdProvider);
    await ref
        .read(aiTutorRepositoryProvider)
        .renameConversation(id, title, userId);
    ref.invalidateSelf();
  }
}

final conversationsControllerProvider =
    AutoDisposeAsyncNotifierProvider<
      ConversationsController,
      List<AiConversation>
    >(ConversationsController.new);

/// `true` khi đang chờ phản hồi AI cho conversation tương ứng.
final chatPendingProvider = StateProvider.autoDispose.family<bool, String>(
  (ref, _) => false,
);

class ChatController
    extends AutoDisposeFamilyAsyncNotifier<List<AiMessage>, String> {
  CancelToken? _activeCancelToken;

  @override
  Future<List<AiMessage>> build(String conversationId) async {
    ref.onDispose(() => _activeCancelToken?.cancel());
    final userId = ref.watch(currentUserIdProvider);
    final repo = ref.read(aiTutorRepositoryProvider);
    final messages = await repo.fetchMessages(
      conversationId: conversationId,
      userId: userId,
    );
    try {
      final pinned = await repo.fetchPinnedMessages(
        conversationId: conversationId,
        userId: userId,
      );
      return _hydrateUnderstandingKeys(
        await _ensureFirstVisitWelcome(
          _mergeOpeningHandoff(
            conversationId,
            _mergePinnedState(messages, pinned),
          ),
        ),
      );
    } catch (_) {
      return _hydrateUnderstandingKeys(
        await _ensureFirstVisitWelcome(
          _mergeOpeningHandoff(conversationId, messages),
        ),
      );
    }
  }

  Future<List<AiMessage>> _hydrateUnderstandingKeys(
    List<AiMessage> messages,
  ) async {
    final storage = ref.read(secureStorageProvider);
    final next = <AiMessage>[];
    for (final message in messages) {
      if (message.isUser ||
          normalizeUnderstandingSelectedKey(
            message.understandingSelectedKey,
          ).isNotEmpty) {
        next.add(message);
        continue;
      }
      final stored = await loadUnderstandingSelectedKey(storage, message.id);
      next.add(
        stored.isEmpty
            ? message
            : message.copyWith(understandingSelectedKey: stored),
      );
    }
    return next;
  }

  static List<AiMessage> _mergePinnedState(
    List<AiMessage> messages,
    List<AiMessage> pinned,
  ) {
    if (pinned.isEmpty) return messages;
    final pinnedById = {for (final m in pinned) m.id: m};
    return messages.map((m) {
      final pin = pinnedById[m.id];
      if (pin == null) return m;
      return m.copyWith(pinned: true, pinnedAt: pin.pinnedAt ?? m.pinnedAt);
    }).toList();
  }

  void cancelPendingRequest() {
    _activeCancelToken?.cancel('User cancelled');
  }

  Future<String> sendMessage({
    required String conversationId,
    required String message,
    required String courseId,
    String? classId,
    String? displayMessage,
    String? interactionType,
    String? codeSnippet,
    String? improvePlanId,
    String? planItemId,
    String? clickedSuggestion,
  }) async {
    _activeCancelToken?.cancel();
    final cancelToken = CancelToken();
    _activeCancelToken = cancelToken;

    final pending = ref.read(pendingTutorRequestContextProvider);
    final callerHasContext =
        (interactionType ?? '').trim().isNotEmpty ||
        (improvePlanId ?? '').trim().isNotEmpty;
    final pendingPrompt = pending?.prompt?.trim() ?? '';
    final usePending =
        pending != null &&
        !callerHasContext &&
        pendingPrompt.isNotEmpty &&
        message.trim() == pendingPrompt;
    final activePending = usePending ? pending : null;
    final resolvedImprovePlanId =
        (improvePlanId ?? activePending?.improvePlanId)?.trim() ?? '';
    final resolvedPlanItemId =
        (planItemId ?? activePending?.planItemId)?.trim() ?? '';
    final resolvedInteractionType =
        (interactionType ?? activePending?.interactionType)?.trim() ?? '';
    final resolvedClicked =
        (clickedSuggestion ?? activePending?.clickedSuggestion)?.trim() ?? '';
    final resolvedDisplay =
        (displayMessage ?? activePending?.displayQuestion)?.trim() ?? '';
    if (usePending ||
        (pending != null &&
            ((improvePlanId ?? '').trim().isNotEmpty ||
                (interactionType ?? '').trim() == 'IMPROVE_PLAN_REVIEW'))) {
      ref.read(pendingTutorRequestContextProvider.notifier).state = null;
    }

    final userId = ref.read(currentUserIdProvider);
    final session = ref.read(authControllerProvider).valueOrNull;
    final repo = ref.read(aiTutorRepositoryProvider);

    final visibleQuestion = resolvedDisplay.isNotEmpty
        ? resolvedDisplay
        : message;
    final snippet = codeSnippet?.trim() ?? '';
    final tutorSession = ref.read(tutorSessionControllerProvider).session;
    final optimistic = AiMessage(
      id: 'local-${DateTime.now().millisecondsSinceEpoch}',
      content: visibleQuestion,
      isUser: true,
      createdAt: DateTime.now(),
      codeSnippet: snippet.isEmpty ? null : snippet,
    );

    final previous = state.valueOrNull ?? [];
    state = AsyncData([...previous, optimistic]);
    ref.read(chatPendingProvider(conversationId).notifier).state = true;

    try {
      final answer = await repo.ask(
        userId: userId,
        courseId: courseId,
        classId: classId,
        conversationId: conversationId,
        message: message,
        studentName: session?.fullName,
        studentEmail: session?.email,
        authToken: session?.token,
        interactionType: resolvedInteractionType.isEmpty
            ? null
            : resolvedInteractionType,
        codeSnippet: snippet.isEmpty ? null : snippet,
        tutorSessionId: tutorSession?.id,
        sessionPhase: tutorSession?.phase,
        improvePlanId: resolvedImprovePlanId.isEmpty
            ? null
            : resolvedImprovePlanId,
        planItemId: resolvedPlanItemId.isEmpty ? null : resolvedPlanItemId,
        clickedSuggestion: resolvedClicked.isEmpty ? null : resolvedClicked,
        cancelToken: cancelToken,
      );

      if (cancelToken.isCancelled) return conversationId;

      ref.read(tutorSessionControllerProvider.notifier).applyAnswer(answer);
      if (answer.dailyQuota?.exhausted == true) {
        unawaited(
          ref
              .read(tutorSessionControllerProvider.notifier)
              .closeIfDailyComplete(0),
        );
      }

      var suggestions = answer.nextImproveSuggestions;
      final hasLessonPath = answerHasLessonPathSuggestions(answer.answer);
      if (suggestions.isEmpty && !hasLessonPath && !answer.escalated) {
        try {
          suggestions = await ref
              .read(improvePlanRepositoryProvider)
              .fetchActionableSuggestions(
                studentId: userId,
                courseId: courseId,
                classId: classId,
                question: message,
              );
        } catch (_) {
          // Không chặn chat nếu gợi ý phụ tải thất bại.
        }
      }

      final effectiveConversationId =
          (answer.conversationId != null && answer.conversationId!.isNotEmpty)
          ? answer.conversationId!
          : conversationId;
      final switchedConversation = effectiveConversationId != conversationId;

      final assistantId = answer.assistantMessageId?.trim() ?? '';
      final aiMessage = AiMessage(
        id: assistantId.isNotEmpty
            ? assistantId
            : 'ai-${DateTime.now().millisecondsSinceEpoch}',
        content: sanitizeAiChatContent(answer.answer),
        isUser: false,
        mode: answer.mode,
        confidence: answer.confidence,
        sources: answer.sources,
        sourceEvidence: answer.sourceEvidence,
        visualEvidence: answer.visualEvidence,
        escalated: answer.escalated,
        questionEscalationId: answer.questionEscalationId,
        improveSuggestions: suggestions,
        createdAt: DateTime.now(),
        conversationId: effectiveConversationId,
        understandingCheck: answer.understandingCheck,
      );
      ref
          .read(chatRevealMessageIdProvider(effectiveConversationId).notifier)
          .state = aiMessage
          .id;

      if (switchedConversation) {
        ref
            .read(chatTurnLimitNoticeProvider.notifier)
            .state = ChatTurnLimitNotice(
          previousSessionId: conversationId,
          currentSessionId: effectiveConversationId,
        );
        ref.invalidate(conversationsControllerProvider);
        return effectiveConversationId;
      }

      // Hiển thị ngay câu trả lời từ /api/ai/query (backend Swagger trả về đúng).
      state = AsyncData([...previous, optimistic, aiMessage]);

      // Đồng bộ id tin nhắn từ server nhưng giữ nội dung từ response query.
      try {
        final messages = await repo.fetchMessages(
          conversationId: effectiveConversationId,
          userId: userId,
        );
        var mergedMessages = messages;
        try {
          final pinned = await repo.fetchPinnedMessages(
            conversationId: effectiveConversationId,
            userId: userId,
          );
          mergedMessages = _mergePinnedState(messages, pinned);
        } catch (_) {}
        if (mergedMessages.length >= previous.length + 2) {
          final latestAi = (state.valueOrNull ?? const <AiMessage>[]).lastWhere(
            (m) => !m.isUser,
            orElse: () => aiMessage,
          );
          state = AsyncData(
            _mergeQueryAnswerIntoHistory(
              messages: _preserveImproveSuggestions(
                previous: [...previous, optimistic, latestAi],
                fetched: _preserveUserCodeSnippets(
                  previous: [...previous, optimistic],
                  fetched: mergedMessages,
                ),
              ),
              answer: answer,
              fallbackAi: latestAi,
              suggestions: suggestions,
            ),
          );
        }
      } catch (_) {
        // Giữ bubble AI từ response query nếu fetch history thất bại.
      }

      ref.invalidate(conversationsControllerProvider);
      ref.invalidate(pinnedMessagesControllerProvider(conversationId));
      ref.invalidate(allPinnedMessagesProvider);
      _syncDailyQuota(courseId: courseId, fromAnswer: answer.dailyQuota);
      final nextQuota = ref.read(dailyQuestionQuotaProvider(courseId));
      if (nextQuota.exhausted) {
        unawaited(
          ref
              .read(tutorSessionControllerProvider.notifier)
              .closeIfDailyComplete(0),
        );
      }
      return effectiveConversationId;
    } on ApiBusinessException catch (e) {
      if (e.isDailyQuestionLimitReached) {
        _markDailyQuotaExhausted(courseId, resetAt: e.resetAt);
        unawaited(
          ref
              .read(tutorSessionControllerProvider.notifier)
              .closeIfDailyComplete(0),
        );
      }
      state = AsyncData([
        ...previous,
        optimistic,
        AiMessage(
          id: 'err-${DateTime.now().millisecondsSinceEpoch}',
          content: describeError(e),
          isUser: false,
          createdAt: DateTime.now(),
        ),
      ]);
    } on DioException catch (e) {
      if (CancelToken.isCancel(e)) return conversationId;
      final business = apiBusinessExceptionFromDio(e);
      if (business?.isDailyQuestionLimitReached == true) {
        _markDailyQuotaExhausted(courseId, resetAt: business!.resetAt);
        unawaited(
          ref
              .read(tutorSessionControllerProvider.notifier)
              .closeIfDailyComplete(0),
        );
      }
      state = AsyncData([
        ...previous,
        optimistic,
        AiMessage(
          id: 'err-${DateTime.now().millisecondsSinceEpoch}',
          content: describeError(e),
          isUser: false,
          createdAt: DateTime.now(),
        ),
      ]);
    } catch (e) {
      state = AsyncData([
        ...previous,
        optimistic,
        AiMessage(
          id: 'err-${DateTime.now().millisecondsSinceEpoch}',
          content: 'Không nhận được phản hồi từ AI.',
          isUser: false,
          createdAt: DateTime.now(),
        ),
      ]);
    } finally {
      if (_activeCancelToken == cancelToken) {
        _activeCancelToken = null;
      }
      ref.read(chatPendingProvider(conversationId).notifier).state = false;
    }
    return conversationId;
  }

  void _syncDailyQuota({
    required String courseId,
    DailyQuestionQuota? fromAnswer,
  }) {
    final quota = ref.read(dailyQuestionQuotaProvider(courseId).notifier);
    if (fromAnswer != null) {
      quota.apply(fromAnswer);
    } else {
      unawaited(quota.refresh());
    }
    final next = ref.read(dailyQuestionQuotaProvider(courseId));
    ref.read(studentDailyQuestionBlockedProvider.notifier).state =
        next.exhausted;
    if (next.resetAt != null) {
      ref.read(studentDailyQuestionResetAtProvider.notifier).state =
          next.resetAt;
    }
  }

  void _markDailyQuotaExhausted(String courseId, {DateTime? resetAt}) {
    ref.read(dailyQuestionQuotaProvider(courseId).notifier).markExhausted();
    ref.read(studentDailyQuestionBlockedProvider.notifier).state = true;
    ref.read(studentDailyQuestionResetAtProvider.notifier).state = resetAt;
  }

  Future<String?> submitReview({
    required String conversationId,
    required AiMessage aiMessage,
    required String userQuestion,
    required String courseId,
    String? classId,
    required String reviewType,
    required int rating,
    required bool accurate,
    required bool helpful,
    String? feedback,
    String? suggestedCorrection,
  }) async {
    final userId = ref.read(currentUserIdProvider);
    final session = ref.read(authControllerProvider).valueOrNull;
    final data = await ref
        .read(aiTutorRepositoryProvider)
        .reviewAnswer(
          studentId: userId,
          courseId: courseId,
          classId: classId,
          conversationId: conversationId,
          mode: aiMessage.mode ?? 'RAG_TUTOR',
          reviewType: reviewType,
          question: userQuestion,
          answer: sanitizeAiChatContent(aiMessage.content),
          aiConfidence: aiMessage.confidence,
          rating: rating,
          accurate: accurate,
          helpful: helpful,
          feedback: feedback,
          suggestedCorrection: suggestedCorrection,
          questionEscalationId: aiMessage.questionEscalationId,
          reviewedBy: userId,
          reviewerRole: 'STUDENT',
          authToken: session?.token,
          correctnessLevel: _correctnessLevelForReview(
            rating: rating,
            accurate: accurate,
          ),
        );
    ref
        .read(reviewedMessageIdsProvider(conversationId).notifier)
        .update((ids) => {...ids, aiMessage.id});
    await persistReviewedMessageIds(
      ref.read(secureStorageProvider),
      conversationId: conversationId,
      ids: ref.read(reviewedMessageIdsProvider(conversationId)),
    );
    final status = data['status'];
    return status is String && status.isNotEmpty ? status : null;
  }

  Future<String> requestMentorReview({
    required String conversationId,
    required AiMessage aiMessage,
    required String userQuestion,
    required String courseId,
    String? classId,
  }) async {
    final session = ref.read(authControllerProvider).valueOrNull;
    if (session == null) {
      throw StateError('User not authenticated');
    }

    final escalationId = await ref
        .read(escalationRepositoryProvider)
        .createMentorReviewRequest(
          studentId: session.userId,
          studentName: session.fullName,
          studentEmail: session.email ?? '',
          courseId: courseId,
          classId: classId,
          conversationId: conversationId,
          question: userQuestion,
          aiResponse: sanitizeAiChatContent(aiMessage.content),
        );

    final current = state.valueOrNull;
    if (current != null) {
      state = AsyncData(
        current
            .map(
              (message) => message.id == aiMessage.id
                  ? message.copyWith(
                      escalated: true,
                      questionEscalationId: escalationId,
                    )
                  : message,
            )
            .toList(),
      );
    }
    return escalationId;
  }

  List<AiMessage> _mergeOpeningHandoff(
    String conversationId,
    List<AiMessage> messages,
  ) {
    final handoff = ref.read(tutorOpeningHandoffProvider);
    if (handoff == null || handoff.conversationId != conversationId) {
      return messages;
    }
    return seedOpeningMessage(messages, handoff.openingMessage);
  }

  /// Cuộc trống + môn đang chọn chưa từng hỏi → lời chào / lộ trình (mọi môn).
  Future<List<AiMessage>> _ensureFirstVisitWelcome(
    List<AiMessage> messages,
  ) async {
    if (messages.isNotEmpty) return messages;
    final active = _activeCourseForChat(ref);
    final courseCode = (active?.code ?? '').trim();
    final classId = resolveTutorClassId(
      classId: active?.classId,
      className: active?.className,
    );
    final userId = ref.read(currentUserIdProvider);
    final repo = ref.read(aiTutorRepositoryProvider);
    if (courseCode.isNotEmpty || (active?.id ?? '').trim().isNotEmpty) {
      final history = await _historyForCourse(
        repo: repo,
        userId: userId,
        courseId: active?.id,
        courseCode: courseCode,
      );
      if (hasStudentChattedCourse(
        history,
        courseId: active?.id,
        courseCode: courseCode,
      )) {
        return messages;
      }
    }

    final bundle = await _resolveFirstVisitOpeningBundle(
      repo: repo,
      userId: userId,
      course: active,
      courseCode: courseCode,
      classId: classId,
    );
    final opened = bundle.session;
    ref.read(tutorSessionControllerProvider.notifier).applyOpened(opened);
    if (opened != null && opened.conversationId.isNotEmpty) {
      ref
          .read(tutorOpeningHandoffProvider.notifier)
          .state = TutorSessionOpenResult(
        conversationId: opened.conversationId,
        openingMessage: bundle.opening,
        resumed: opened.resumed,
        session: opened.session,
      );
    }
    return seedOpeningMessage(messages, bundle.opening);
  }

  /// Câu hỏi user ngay trước câu trả lời AI (theo thứ tự trong history).
  static String? precedingUserQuestion(
    List<AiMessage> messages,
    int aiMessageIndex,
  ) {
    for (var i = aiMessageIndex - 1; i >= 0; i--) {
      if (messages[i].isUser) return messages[i].content;
    }
    return null;
  }

  bool _isPersistedMessageId(String messageId) {
    return !messageId.startsWith('local-') &&
        !messageId.startsWith('ai-') &&
        !messageId.startsWith('err-');
  }

  Future<void> lockUnderstandingAnswer({
    required String conversationId,
    required AiMessage message,
    required String selectedKey,
  }) async {
    final key = normalizeUnderstandingSelectedKey(selectedKey);
    if (key.isEmpty) return;
    final messageId = message.id.trim();
    if (messageId.isEmpty || message.isUser) return;
    if (normalizeUnderstandingSelectedKey(
      message.understandingSelectedKey,
    ).isNotEmpty) {
      return;
    }

    final current = state.valueOrNull ?? const <AiMessage>[];
    state = AsyncData([
      for (final item in current)
        item.id == messageId
            ? item.copyWith(understandingSelectedKey: key)
            : item,
    ]);

    await persistUnderstandingSelectedKey(
      ref.read(secureStorageProvider),
      messageId: messageId,
      selectedKey: key,
    );

    if (!_isPersistedMessageId(messageId)) return;
    try {
      await ref
          .read(aiTutorRepositoryProvider)
          .recordUnderstandingCheck(
            conversationId: message.conversationId?.trim().isNotEmpty == true
                ? message.conversationId!
                : conversationId,
            messageId: messageId,
            userId: ref.read(currentUserIdProvider),
            selectedKey: key,
          );
    } catch (_) {
      // Giữ khóa local giống web khi lưu server thất bại.
    }
  }

  Future<void> learnFromSuggestionInChat({
    required String conversationId,
    required String courseId,
    String? classId,
    required ImproveSuggestionItem suggestion,
  }) async {
    ref.read(chatPendingProvider(conversationId).notifier).state = true;
    final userId = ref.read(currentUserIdProvider);
    final repo = ref.read(aiTutorRepositoryProvider);
    final improveRepo = ref.read(improvePlanRepositoryProvider);

    try {
      final result = await improveRepo.learnFromSuggestion(
        studentId: userId,
        courseId: courseId,
        classId: classId,
        conversationId: conversationId,
        topic: suggestion.effectiveTopic,
        suggestionText: suggestion.effectiveText,
        suggestionKey: suggestion.key,
      );

      ref
          .read(consumedSuggestionKeysProvider(conversationId).notifier)
          .update((keys) => {...keys, suggestion.key});

      final nextSuggestions = result.nextImproveSuggestions.isNotEmpty
          ? ImproveSuggestionItem.actionableChips(result.nextImproveSuggestions)
          : <ImproveSuggestionItem>[];

      try {
        final messages = await repo.fetchMessages(
          conversationId: conversationId,
          userId: userId,
        );
        state = AsyncData(
          _attachSuggestionsToLastAi(
            _preserveImproveSuggestions(
              previous: state.valueOrNull ?? [],
              fetched: messages,
            ),
            nextSuggestions,
            result.answer,
          ),
        );
      } catch (_) {
        final previous = state.valueOrNull ?? [];
        final userMsg = AiMessage(
          id:
              result.userMessageId ??
              'local-${DateTime.now().millisecondsSinceEpoch}',
          content: suggestion.effectiveText,
          isUser: true,
          createdAt: DateTime.now(),
        );
        final aiMsg = AiMessage(
          id:
              result.assistantMessageId ??
              'ai-${DateTime.now().millisecondsSinceEpoch}',
          content: sanitizeAiChatContent(result.answer ?? ''),
          isUser: false,
          improveSuggestions: nextSuggestions,
          createdAt: DateTime.now(),
        );
        state = AsyncData([...previous, userMsg, aiMsg]);
      }

      ref.invalidate(conversationsControllerProvider);
    } on DioException catch (e) {
      if (e.response?.statusCode == 409) {
        ref
            .read(consumedSuggestionKeysProvider(conversationId).notifier)
            .update((keys) => {...keys, suggestion.key});
      }
      rethrow;
    } finally {
      ref.read(chatPendingProvider(conversationId).notifier).state = false;
    }
  }

  static List<AiMessage> _preserveUserCodeSnippets({
    required List<AiMessage> previous,
    required List<AiMessage> fetched,
  }) {
    final codes = [
      for (final message in previous)
        if (message.isUser) message.codeSnippet,
    ];
    var userIndex = 0;
    return fetched.map((message) {
      if (!message.isUser) return message;
      final previousCode = userIndex < codes.length ? codes[userIndex] : null;
      userIndex += 1;
      if ((message.codeSnippet ?? '').trim().isNotEmpty) return message;
      if (previousCode == null || previousCode.trim().isEmpty) return message;
      return message.copyWith(codeSnippet: previousCode);
    }).toList();
  }

  static List<AiMessage> _preserveImproveSuggestions({
    required List<AiMessage> previous,
    required List<AiMessage> fetched,
  }) {
    final suggestionsById = {
      for (final m in previous)
        if (!m.isUser && m.improveSuggestions.isNotEmpty)
          m.id: m.improveSuggestions,
    };
    return fetched
        .map(
          (m) => m.isUser || m.improveSuggestions.isNotEmpty
              ? m
              : m.copyWith(
                  improveSuggestions: suggestionsById[m.id] ?? const [],
                ),
        )
        .toList();
  }

  static List<AiMessage> _attachSuggestionsToLastAi(
    List<AiMessage> messages,
    List<ImproveSuggestionItem> suggestions,
    String? answerFallback,
  ) {
    if (messages.isEmpty) return messages;
    final aiIndex = messages.lastIndexWhere((m) => !m.isUser);
    if (aiIndex < 0) return messages;

    final merged = List<AiMessage>.from(messages);
    final current = merged[aiIndex];
    merged[aiIndex] = current.copyWith(
      content: answerFallback != null && answerFallback.trim().isNotEmpty
          ? sanitizeAiChatContent(answerFallback)
          : current.content,
      improveSuggestions: suggestions,
    );
    return merged;
  }

  /// Gắn id server cho tin AI nhưng ưu tiên nội dung từ `/api/ai/query`.
  static List<AiMessage> _mergeQueryAnswerIntoHistory({
    required List<AiMessage> messages,
    required AiAnswer answer,
    required AiMessage fallbackAi,
    List<ImproveSuggestionItem> suggestions = const [],
  }) {
    final aiIndex = messages.lastIndexWhere((m) => !m.isUser);
    if (aiIndex < 0) return messages;

    final serverAi = messages[aiIndex];
    final queryContent = answer.answer.trim();
    final useContent = queryContent.isNotEmpty
        ? sanitizeAiChatContent(answer.answer)
        : sanitizeAiChatContent(serverAi.content);

    final merged = List<AiMessage>.from(messages);
    merged[aiIndex] = AiMessage(
      id: serverAi.id,
      content: useContent,
      isUser: false,
      mode: answer.mode ?? serverAi.mode,
      confidence: answer.confidence ?? serverAi.confidence,
      sources: answer.sources.isNotEmpty ? answer.sources : serverAi.sources,
      sourceEvidence: answer.sourceEvidence.isNotEmpty
          ? answer.sourceEvidence
          : serverAi.sourceEvidence,
      visualEvidence: answer.visualEvidence.isNotEmpty
          ? answer.visualEvidence
          : serverAi.visualEvidence,
      escalated:
          answer.escalated ||
          answer.questionEscalationId != null ||
          serverAi.escalated ||
          serverAi.questionEscalationId != null,
      questionEscalationId:
          answer.questionEscalationId ?? serverAi.questionEscalationId,
      pinned: serverAi.pinned,
      pinnedAt: serverAi.pinnedAt,
      createdAt: serverAi.createdAt ?? fallbackAi.createdAt,
      conversationId: serverAi.conversationId ?? fallbackAi.conversationId,
      improveSuggestions: suggestions.isNotEmpty
          ? suggestions
          : fallbackAi.improveSuggestions,
      understandingCheck:
          answer.understandingCheck ??
          serverAi.understandingCheck ??
          fallbackAi.understandingCheck,
      understandingSelectedKey:
          normalizeUnderstandingSelectedKey(
            serverAi.understandingSelectedKey,
          ).isNotEmpty
          ? serverAi.understandingSelectedKey
          : fallbackAi.understandingSelectedKey,
    );
    return merged;
  }

  /// Trả về `true` nếu vừa ghim, `false` nếu vừa bỏ ghim, `null` nếu không thao tác.
  Future<bool?> togglePinMessage({
    required String conversationId,
    required String messageId,
  }) async {
    if (!_isPersistedMessageId(messageId)) return null;

    final userId = ref.read(currentUserIdProvider);
    final repo = ref.read(aiTutorRepositoryProvider);
    final current = state.valueOrNull ?? [];
    final index = current.indexWhere((m) => m.id == messageId);

    late final bool willPin;
    if (index >= 0) {
      willPin = !current[index].pinned;
    } else {
      try {
        final pinned = await repo.fetchPinnedMessages(
          conversationId: conversationId,
          userId: userId,
        );
        willPin = !pinned.any((m) => m.id == messageId);
      } catch (_) {
        return null;
      }
    }

    if (willPin) {
      await repo.pinMessage(
        conversationId: conversationId,
        messageId: messageId,
        userId: userId,
      );
    } else {
      await repo.unpinMessage(
        conversationId: conversationId,
        messageId: messageId,
        userId: userId,
      );
    }

    if (index >= 0) {
      state = AsyncData(
        current
            .map(
              (m) => m.id == messageId
                  ? m.copyWith(
                      pinned: willPin,
                      pinnedAt: willPin ? DateTime.now() : null,
                    )
                  : m,
            )
            .toList(),
      );
    } else {
      ref.invalidateSelf();
    }
    ref.invalidate(pinnedMessagesControllerProvider(conversationId));
    ref.invalidate(allPinnedMessagesProvider);
    return willPin;
  }
}

class PinnedMessagesController
    extends AutoDisposeFamilyAsyncNotifier<List<AiMessage>, String> {
  @override
  Future<List<AiMessage>> build(String conversationId) async {
    final userId = ref.watch(currentUserIdProvider);
    return ref
        .read(aiTutorRepositoryProvider)
        .fetchPinnedMessages(conversationId: conversationId, userId: userId);
  }
}

final pinnedMessagesControllerProvider =
    AutoDisposeAsyncNotifierProviderFamily<
      PinnedMessagesController,
      List<AiMessage>,
      String
    >(PinnedMessagesController.new);

/// Tất cả tin đã ghim của user — gộp từ mọi cuộc trò chuyện (theo môn đang chọn).
final allPinnedMessagesProvider =
    FutureProvider.autoDispose<List<PinnedMessageEntry>>((ref) async {
      final userId = ref.watch(currentUserIdProvider);
      final conversations = await ref.watch(
        conversationsControllerProvider.future,
      );
      if (conversations.isEmpty) return const [];

      final titles = {for (final c in conversations) c.id: c.title};
      final repo = ref.read(aiTutorRepositoryProvider);
      final batches = await Future.wait(
        conversations.map((conversation) async {
          try {
            final pins = await repo.fetchPinnedMessages(
              conversationId: conversation.id,
              userId: userId,
            );
            return pins
                .map(
                  (m) => PinnedMessageEntry(
                    message: m,
                    conversationTitle: titles[conversation.id] ?? 'Hội thoại',
                  ),
                )
                .toList();
          } catch (_) {
            return <PinnedMessageEntry>[];
          }
        }),
      );

      final merged = batches.expand((batch) => batch).toList();
      merged.sort((a, b) {
        final ta =
            a.message.pinnedAt ??
            a.message.createdAt ??
            DateTime.fromMillisecondsSinceEpoch(0);
        final tb =
            b.message.pinnedAt ??
            b.message.createdAt ??
            DateTime.fromMillisecondsSinceEpoch(0);
        return tb.compareTo(ta);
      });
      return merged;
    });

class PinnedMessageEntry {
  const PinnedMessageEntry({
    required this.message,
    required this.conversationTitle,
  });

  final AiMessage message;
  final String conversationTitle;
}

/// Tin ghim hiển thị UI: gộp API + trạng thái local trong cuộc trò chuyện.
final effectivePinnedMessagesProvider = Provider.autoDispose
    .family<List<AiMessage>, String>((ref, conversationId) {
      final chatPinned =
          ref
              .watch(chatControllerProvider(conversationId))
              .valueOrNull
              ?.where((m) => m.pinned && !m.isUser)
              .toList() ??
          [];
      final apiPinned =
          ref
              .watch(pinnedMessagesControllerProvider(conversationId))
              .valueOrNull ??
          [];

      final merged = <String, AiMessage>{for (final m in apiPinned) m.id: m};
      for (final m in chatPinned) {
        merged[m.id] = m;
      }

      final list = merged.values.toList();
      list.sort((a, b) {
        final ta =
            a.pinnedAt ?? a.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
        final tb =
            b.pinnedAt ?? b.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
        return tb.compareTo(ta);
      });
      return list;
    });

final chatControllerProvider =
    AutoDisposeAsyncNotifierProviderFamily<
      ChatController,
      List<AiMessage>,
      String
    >(ChatController.new);

class CodeMentorController extends AutoDisposeAsyncNotifier<AiAnswer?> {
  @override
  Future<AiAnswer?> build() async => null;

  Future<void> ask({
    required String courseId,
    required String question,
    required String code,
    required String language,
    bool assignmentRelated = false,
    String? classId,
  }) async {
    state = const AsyncLoading();
    final userId = ref.read(currentUserIdProvider);
    final session = ref.read(authControllerProvider).valueOrNull;
    final tutor = ref.read(tutorSessionControllerProvider).session;
    final conversations = ref.read(conversationsControllerProvider).valueOrNull;
    final conversationId = conversations
        ?.where(
          (item) =>
              conversationBelongsToCourse(
                item,
                courseId: courseId,
                courseCode: courseId,
              ) ||
              item.courseId == null,
        )
        .map((item) => item.id)
        .where((id) => id.isNotEmpty)
        .firstOrNull;
    state = await AsyncValue.guard(
      () => ref
          .read(aiTutorRepositoryProvider)
          .codeMentorQuery(
            studentId: userId,
            courseId: courseId,
            classId: classId,
            conversationId: conversationId,
            question: question,
            code: code,
            language: language,
            assignmentRelated: assignmentRelated,
            authToken: session?.token,
            studentName: session?.fullName,
            studentEmail: session?.email,
            tutorSessionId: tutor?.id,
            sessionPhase: tutor?.phase,
          ),
    );
  }
}

final codeMentorControllerProvider =
    AutoDisposeAsyncNotifierProvider<CodeMentorController, AiAnswer?>(
      CodeMentorController.new,
    );

/// Tìm tin nhắn trong lịch sử chat qua `/api/ai/conversations/search`.
final chatMessageSearchProvider = FutureProvider.autoDispose
    .family<List<AiMessage>, String>((ref, keyword) async {
      final trimmed = keyword.trim();
      if (trimmed.isEmpty) return const [];

      final userId = ref.watch(currentUserIdProvider);
      final course = ref.watch(selectedCourseProvider);
      final courses = ref.watch(coursesControllerProvider).valueOrNull;
      final activeCourse = course ?? courses?.firstOrNull;

      return ref
          .read(aiTutorRepositoryProvider)
          .searchMessages(
            userId: userId,
            keyword: trimmed,
            courseId: activeCourse?.id,
          );
    });
