import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/utils/ai_chat_content.dart';
import '../../../shared/models/ai_conversation.dart';
import '../../../shared/models/course.dart';
import '../../../shared/models/improve_suggestion.dart';
import '../../auth/application/auth_controller.dart';
import '../../courses/application/courses_controller.dart';
import '../../memory/data/improve_plan_repository.dart';
import '../data/ai_tutor_repository.dart';

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

/// Các suggestion đã bấm "Học ngay" trong một cuộc trò chuyện.
final consumedSuggestionKeysProvider = StateProvider.autoDispose
    .family<Set<String>, String>((ref, conversationId) => {});

/// Các tin nhắn AI đã được học sinh review trong phiên hiện tại.
final reviewedMessageIdsProvider = StateProvider.autoDispose
    .family<Set<String>, String>((ref, conversationId) => {});

/// `true` khi backend trả `DAILY_QUESTION_LIMIT_REACHED` (BE mới).
final studentDailyQuestionBlockedProvider = StateProvider<bool>((ref) => false);

class ConversationsController
    extends AutoDisposeAsyncNotifier<List<AiConversation>> {
  @override
  Future<List<AiConversation>> build() async {
    final userId = ref.watch(currentUserIdProvider);
    final course = ref.watch(selectedCourseProvider);
    final courses = ref.watch(coursesControllerProvider).valueOrNull;
    final activeCourse = course ?? courses?.firstOrNull;
    return ref.read(aiTutorRepositoryProvider).fetchConversations(
      userId,
      courseId: activeCourse?.id,
    );
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
      return _mergePinnedState(messages, pinned);
    } catch (_) {
      return messages;
    }
  }

  static List<AiMessage> _mergePinnedState(
    List<AiMessage> messages,
    List<AiMessage> pinned,
  ) {
    if (pinned.isEmpty) return messages;
    final pinnedById = {for (final m in pinned) m.id: m};
    return messages
        .map((m) {
          final pin = pinnedById[m.id];
          if (pin == null) return m;
          return m.copyWith(
            pinned: true,
            pinnedAt: pin.pinnedAt ?? m.pinnedAt,
          );
        })
        .toList();
  }

  void cancelPendingRequest() {
    _activeCancelToken?.cancel('User cancelled');
  }

  Future<String> sendMessage({
    required String conversationId,
    required String message,
    required String courseId,
    String? classId,
  }) async {
    _activeCancelToken?.cancel();
    final cancelToken = CancelToken();
    _activeCancelToken = cancelToken;

    final userId = ref.read(currentUserIdProvider);
    final session = ref.read(authControllerProvider).valueOrNull;
    final repo = ref.read(aiTutorRepositoryProvider);

    final optimistic = AiMessage(
      id: 'local-${DateTime.now().millisecondsSinceEpoch}',
      content: message,
      isUser: true,
      createdAt: DateTime.now(),
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
        cancelToken: cancelToken,
      );

      if (cancelToken.isCancelled) return conversationId;

      var suggestions = answer.nextImproveSuggestions;
      if (suggestions.isEmpty && !answer.escalated) {
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

      final aiMessage = AiMessage(
        id: 'ai-${DateTime.now().millisecondsSinceEpoch}',
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
      );

      if (switchedConversation) {
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
          state = AsyncData(
            _mergeQueryAnswerIntoHistory(
              messages: _preserveImproveSuggestions(
                previous: [...previous, optimistic, aiMessage],
                fetched: mergedMessages,
              ),
              answer: answer,
              fallbackAi: aiMessage,
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
      return effectiveConversationId;
    } on ApiBusinessException catch (e) {
      if (e.isDailyQuestionLimitReached) {
        ref.read(studentDailyQuestionBlockedProvider.notifier).state = true;
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
    final data = await ref.read(aiTutorRepositoryProvider).reviewAnswer(
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
    ref.read(reviewedMessageIdsProvider(conversationId).notifier).update(
          (ids) => {...ids, aiMessage.id},
        );
    final status = data['status'];
    return status is String && status.isNotEmpty ? status : null;
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

      ref.read(consumedSuggestionKeysProvider(conversationId).notifier).update(
        (keys) => {...keys, suggestion.key},
      );

      final nextSuggestions = result.nextImproveSuggestions.isNotEmpty
          ? ImproveSuggestionItem.actionableChips(
              result.nextImproveSuggestions,
            )
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
          id: result.userMessageId ??
              'local-${DateTime.now().millisecondsSinceEpoch}',
          content: suggestion.effectiveText,
          isUser: true,
          createdAt: DateTime.now(),
        );
        final aiMsg = AiMessage(
          id: result.assistantMessageId ??
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
        ref.read(consumedSuggestionKeysProvider(conversationId).notifier).update(
          (keys) => {...keys, suggestion.key},
        );
      }
      rethrow;
    } finally {
      ref.read(chatPendingProvider(conversationId).notifier).state = false;
    }
  }

  static List<AiMessage> _preserveImproveSuggestions({
    required List<AiMessage> previous,
    required List<AiMessage> fetched,
  }) {
    final suggestionsById = {
      for (final m in previous)
        if (!m.isUser && m.improveSuggestions.isNotEmpty) m.id: m.improveSuggestions,
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
      improveSuggestions: suggestions.isNotEmpty
          ? suggestions
          : fallbackAi.improveSuggestions,
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
      final conversations = await ref.watch(conversationsControllerProvider.future);
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
    state = await AsyncValue.guard(
      () => ref
          .read(aiTutorRepositoryProvider)
          .codeMentorQuery(
            studentId: userId,
            courseId: courseId,
            classId: classId,
            question: question,
            code: code,
            language: language,
            assignmentRelated: assignmentRelated,
            authToken: session?.token,
            studentName: session?.fullName,
            studentEmail: session?.email,
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

      return ref.read(aiTutorRepositoryProvider).searchMessages(
        userId: userId,
        keyword: trimmed,
        courseId: activeCourse?.id,
      );
    });
