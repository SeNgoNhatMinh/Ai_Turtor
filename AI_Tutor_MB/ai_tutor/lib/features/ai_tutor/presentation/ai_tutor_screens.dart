import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:speech_to_text/speech_to_text.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/utils/authenticated_file_open.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_motion.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_tokens.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/ai_chat_content.dart';
import '../../../core/utils/study_suggestion_prompt.dart';
import '../../../core/utils/chat_turn_limit.dart';
import '../../../core/utils/conversation_time_groups.dart';
import '../../../core/utils/reviewed_message_ids.dart';
import '../../student/student_route_handoff.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/models/improve_suggestion.dart';
import '../../../shared/models/rag_source_evidence.dart';
import '../../../shared/models/ai_conversation.dart';
import '../../../shared/models/course.dart';
import '../../../shared/models/escalation.dart';
import '../../../shared/widgets/chat_bubble.dart';
import '../../../shared/widgets/ai_suggestion_json.dart';
import '../../../shared/widgets/widgets.dart';
import '../../auth/application/auth_controller.dart';
import '../../courses/application/courses_controller.dart';
import '../../courses/data/courses_repository.dart';
import '../../escalation/application/escalation_controller.dart';
import '../../memory/presentation/widgets/improve_suggestion_widgets.dart';
import '../application/ai_tutor_controller.dart';
import '../application/daily_question_quota_controller.dart';
import '../application/tts_controller.dart';
import '../data/chat_improve_suggestions.dart';
import '../data/code_mentor.dart';
import '../data/tutor_session.dart';
import '../data/tts_models.dart';
import '../data/understanding_check.dart';
import 'widgets/ai_chat_widgets.dart';
import 'widgets/lesson_deep_dive_cta.dart';
import 'widgets/tts_widgets.dart';
import 'widgets/understanding_check_quiz.dart';

/// Điểm vào tab "Ask Cóc": mở / resume buổi học giống web
/// (`POST /api/tutor/sessions/open`) rồi vào conversation của buổi đó.
class TutorEntryScreen extends HookConsumerWidget {
  const TutorEntryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final creationError = useState<Object?>(null);
    final retryTick = useState(0);

    useEffect(() {
      Future<void> resolve() async {
        try {
          final courses = ref.read(coursesControllerProvider).valueOrNull;
          final course =
              ref.read(selectedCourseProvider) ?? courses?.firstOrNull;
          final created = await ref
              .read(conversationsControllerProvider.notifier)
              .openTutorSessionOrCreate(
                courseId: course?.code,
                classId: course?.classId,
              );
          if (context.mounted) {
            context.go(AppRoutes.studentTutorChat(created.id));
          }
        } catch (e) {
          if (context.mounted) creationError.value = e;
        }
      }

      // Đẩy sang microtask để tránh gọi context.go() (setState trên Router)
      // ngay trong pha build của widget này, việc có thể ném lỗi
      // "setState() called during build" và làm màn hình kẹt lại.
      Future.microtask(resolve);
      return null;
    }, [retryTick.value]);

    final error = creationError.value;
    if (error != null) {
      return Scaffold(
        backgroundColor: Colors.transparent,
        body: SafeArea(
          child: ErrorState(
            message: describeError(error),
            onRetry: () {
              creationError.value = null;
              retryTick.value++;
            },
          ),
        ),
      );
    }

    return const _TutorEntryLoading();
  }
}

class _TutorEntryLoading extends StatelessWidget {
  const _TutorEntryLoading();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(child: LoadingSkeleton(itemCount: 4)),
    );
  }
}

/// Lịch sử hội thoại AI Tutor, hiển thị dạng Drawer bên trái mở từ
/// [ChatScreen] — giống thanh sidebar của ChatGPT. Hiển thị mọi tin đã ghim
/// của user (mọi cuộc trò chuyện trong môn đang chọn), không chỉ cuộc đang mở.
class ConversationHistoryDrawer extends HookConsumerWidget {
  const ConversationHistoryDrawer({
    super.key,
    this.activeConversationId,
    this.onViewPinnedMessage,
  });

  final String? activeConversationId;

  /// Gọi khi người dùng bấm vào một tin đã ghim, để [ChatScreen] cuộn tới
  /// tin nhắn đó trong cuộc trò chuyện đang mở.
  final ValueChanged<String>? onViewPinnedMessage;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final conversations = ref.watch(conversationsControllerProvider);
    final searchQuery = useState('');
    final debouncedQuery = useState('');
    final activeId = activeConversationId;
    final pinnedEntries =
        ref.watch(allPinnedMessagesProvider).valueOrNull ??
        const <PinnedMessageEntry>[];

    useEffect(() {
      final timer = Timer(const Duration(milliseconds: 350), () {
        debouncedQuery.value = searchQuery.value;
      });
      return timer.cancel;
    }, [searchQuery.value]);

    final visibleCount = useState(conversationPageSize);
    final isSearching = debouncedQuery.value.trim().isNotEmpty;
    final searchResults = isSearching
        ? ref.watch(chatMessageSearchProvider(debouncedQuery.value.trim()))
        : null;

    void openSearchResult(AiMessage message) {
      final targetConversationId = message.conversationId;
      if (targetConversationId == null || targetConversationId.isEmpty) return;
      Navigator.of(context).pop();
      if (targetConversationId == activeConversationId) {
        onViewPinnedMessage?.call(message.id);
        return;
      }
      context.go(
        AppRoutes.studentTutorChat(targetConversationId, messageId: message.id),
      );
    }

    void openConversation(String id) {
      Navigator.of(context).pop();
      if (id != activeConversationId) {
        context.go(AppRoutes.studentTutorChat(id));
      }
    }

    Future<void> createNew() async {
      final created = await ref
          .read(conversationsControllerProvider.notifier)
          .createNew();
      if (!context.mounted) return;
      Navigator.of(context).pop();
      context.go(AppRoutes.studentTutorChat(created.id));
    }

    return Drawer(
      width: MediaQuery.sizeOf(context).width * 0.88,
      backgroundColor: AppColors.canvas,
      elevation: 16,
      shadowColor: AppColors.scrim,
      shape: const RoundedRectangleBorder(),
      child: SafeArea(
        child: DecoratedBox(
          decoration: const BoxDecoration(
            color: AppColors.canvas,
            border: Border(right: BorderSide(color: AppColors.borderHairline)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  Insets.screenH,
                  Insets.md,
                  Insets.screenH,
                  Insets.md,
                ),
                child: Text(
                  'Hội thoại',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: AppColors.splashNavy,
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  Insets.screenH,
                  0,
                  Insets.screenH,
                  Insets.md,
                ),
                child: _SearchBar(onChanged: (v) => searchQuery.value = v),
              ),
              if (!isSearching && pinnedEntries.isNotEmpty)
                _DrawerPinnedSection(
                  entries: pinnedEntries,
                  title: l10n.pinnedMessagesTitle,
                  onTap: (entry) {
                    final message = entry.message;
                    final targetConversationId = message.conversationId;
                    Navigator.of(context).pop();
                    if (targetConversationId == null ||
                        targetConversationId.isEmpty) {
                      onViewPinnedMessage?.call(message.id);
                      return;
                    }
                    if (targetConversationId == activeConversationId) {
                      onViewPinnedMessage?.call(message.id);
                      return;
                    }
                    context.go(
                      AppRoutes.studentTutorChat(
                        targetConversationId,
                        messageId: message.id,
                      ),
                    );
                  },
                  onUnpin: (entry) async {
                    final message = entry.message;
                    final convId = message.conversationId ?? activeId;
                    if (convId == null) return;
                    try {
                      await ref
                          .read(chatControllerProvider(convId).notifier)
                          .togglePinMessage(
                            conversationId: convId,
                            messageId: message.id,
                          );
                    } catch (e) {
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(
                        context,
                      ).showSnackBar(SnackBar(content: Text(describeError(e))));
                    }
                  },
                ),
              // ── Scrollable list ───────────────────────────────────
              Expanded(
                child: isSearching
                    ? searchResults!.when(
                        loading: () => const LoadingSkeleton(),
                        error: (error, _) => ErrorState(
                          message: describeError(error),
                          onRetry: () => ref.invalidate(
                            chatMessageSearchProvider(
                              debouncedQuery.value.trim(),
                            ),
                          ),
                        ),
                        data: (items) {
                          if (items.isEmpty) {
                            return EmptyState(
                              title: 'Không tìm thấy tin nhắn',
                              message:
                                  'Thử từ khóa khác trong nội dung câu hỏi hoặc câu trả lời AI.',
                            );
                          }
                          return ListView.separated(
                            padding: const EdgeInsets.fromLTRB(
                              Insets.screenH,
                              Insets.sm,
                              Insets.screenH,
                              Insets.lg,
                            ),
                            itemCount: items.length,
                            separatorBuilder: (_, __) => const Gap(Insets.sm),
                            itemBuilder: (context, index) {
                              return _SearchMessageTile(
                                message: items[index],
                                onTap: () => openSearchResult(items[index]),
                              );
                            },
                          );
                        },
                      )
                    : conversations.when(
                        loading: () => const LoadingSkeleton(),
                        error: (error, _) => ErrorState(
                          message: describeError(error),
                          onRetry: () =>
                              ref.invalidate(conversationsControllerProvider),
                        ),
                        data: (allItems) {
                          if (allItems.isEmpty) {
                            return EmptyState(
                              title: l10n.emptyConversationsTitle,
                              message: l10n.emptyConversationsMessage,
                              ctaLabel: l10n.newConversation,
                              onCta: createNew,
                            );
                          }

                          final orderedItems = sortConversationsByActivity(
                            allItems,
                          );
                          final visibleItems =
                              orderedItems.length <= visibleCount.value
                              ? orderedItems
                              : orderedItems.take(visibleCount.value).toList();
                          final groups = groupConversationsByTime(visibleItems);
                          final hasMore = visibleCount.value < allItems.length;

                          return RefreshIndicator(
                            color: AppColors.primary,
                            onRefresh: () => ref.refresh(
                              conversationsControllerProvider.future,
                            ),
                            child: ListView(
                              padding: const EdgeInsets.fromLTRB(
                                Insets.screenH,
                                Insets.sm,
                                Insets.screenH,
                                Insets.lg,
                              ),
                              children: [
                                for (final group in groups) ...[
                                  _SectionLabel(group.label.toUpperCase()),
                                  const Gap(Insets.sm),
                                  _ConversationGroup(
                                    items: group.items,
                                    activeId: activeConversationId,
                                    onTap: openConversation,
                                    onDelete: (id) => ref
                                        .read(
                                          conversationsControllerProvider
                                              .notifier,
                                        )
                                        .deleteConversation(id),
                                    onRename: (id, title) => ref
                                        .read(
                                          conversationsControllerProvider
                                              .notifier,
                                        )
                                        .renameConversation(id, title),
                                  ),
                                  const Gap(Insets.xl),
                                ],
                                if (hasMore)
                                  TextButton(
                                    onPressed: () {
                                      visibleCount.value =
                                          (visibleCount.value +
                                                  conversationPageSize)
                                              .clamp(0, allItems.length);
                                    },
                                    child: const Text('Xem thêm'),
                                  ),
                              ],
                            ),
                          );
                        },
                      ),
              ),
              // ── New conversation button ───────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  Insets.screenH,
                  Insets.sm,
                  Insets.screenH,
                  Insets.lg,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _NewConversationButton(
                      label: l10n.newConversation,
                      onTap: createNew,
                    ),
                    const Gap(Insets.sm),
                    TextButton.icon(
                      onPressed: () {
                        Navigator.of(context).pop();
                        context.go(AppRoutes.studentHome);
                      },
                      icon: const Icon(LucideIcons.home, size: 18),
                      label: Text(l10n.tabHome),
                      style: TextButton.styleFrom(
                        foregroundColor: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

bool _isPersistedMessageId(String messageId) {
  return !messageId.startsWith('local-') &&
      !messageId.startsWith('ai-') &&
      !messageId.startsWith('err-');
}

void _copyAiAnswer(BuildContext context, String content) {
  final l10n = AppLocalizations.of(context)!;
  Clipboard.setData(ClipboardData(text: sanitizeAiChatContent(content)));
  ScaffoldMessenger.of(
    context,
  ).showSnackBar(SnackBar(content: Text(l10n.copiedSnack)));
}

Color _courseChipColor(String? courseId) {
  if (courseId == null) return AppColors.raised;
  final id = courseId.toUpperCase();
  if (id.startsWith('DBI') || id.startsWith('SWD') || id.startsWith('PRO')) {
    return AppColors.infoBg;
  }
  if (id.startsWith('PRF') || id.startsWith('PRN') || id.startsWith('CSD')) {
    return AppColors.primaryWash;
  }
  if (id.startsWith('SWE') || id.startsWith('SWT') || id.startsWith('SWR')) {
    return AppColors.successBg;
  }
  return AppColors.raised;
}

Color _courseChipTextColor(String? courseId) {
  if (courseId == null) return AppColors.textTertiary;
  final id = courseId.toUpperCase();
  if (id.startsWith('DBI') || id.startsWith('SWD') || id.startsWith('PRO')) {
    return AppColors.peacockBlue;
  }
  if (id.startsWith('PRF') || id.startsWith('PRN') || id.startsWith('CSD')) {
    return AppColors.primaryDark;
  }
  if (id.startsWith('SWE') || id.startsWith('SWT') || id.startsWith('SWR')) {
    return AppColors.success;
  }
  return AppColors.textSecondary;
}

class _SearchBar extends StatelessWidget {
  const _SearchBar({required this.onChanged});

  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 48,
      decoration: BoxDecoration(
        color: AppColors.raised,
        borderRadius: BorderRadius.circular(Radii.md),
      ),
      padding: const EdgeInsets.symmetric(horizontal: Insets.md),
      child: Row(
        children: [
          const Icon(
            LucideIcons.search,
            size: 18,
            color: AppColors.textTertiary,
          ),
          const Gap(Insets.sm),
          Expanded(
            child: TextField(
              onChanged: onChanged,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: AppColors.textPrimary),
              decoration: InputDecoration(
                hintText: 'Tìm tin nhắn trong lịch sử',
                hintStyle: Theme.of(context).textTheme.bodyMedium,
                border: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: Theme.of(context).textTheme.bodySmall?.copyWith(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.2,
        color: AppColors.textTertiary,
      ),
    );
  }
}

class _SearchMessageTile extends StatelessWidget {
  const _SearchMessageTile({required this.message, required this.onTap});

  final AiMessage message;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final excerpt = sanitizeAiChatContent(
      message.content,
    ).replaceAll(RegExp(r'\s+'), ' ').trim();
    final timeLabel = message.createdAt != null
        ? formatRelativeTime(message.createdAt!)
        : null;

    return Material(
      color: AppColors.card,
      borderRadius: BorderRadius.circular(Radii.md),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(Radii.md),
        child: Padding(
          padding: const EdgeInsets.all(Insets.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: Insets.sm,
                      vertical: Insets.xs,
                    ),
                    decoration: BoxDecoration(
                      color: message.isUser
                          ? AppColors.primaryWash
                          : AppColors.infoBg,
                      borderRadius: BorderRadius.circular(Radii.full),
                    ),
                    child: Text(
                      message.isUser ? 'Bạn' : 'AI',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: message.isUser
                            ? AppColors.primaryDark
                            : AppColors.peacockBlue,
                        fontSize: 11,
                      ),
                    ),
                  ),
                  if (timeLabel != null) ...[
                    const Spacer(),
                    Text(
                      timeLabel,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textTertiary,
                      ),
                    ),
                  ],
                ],
              ),
              const Gap(Insets.sm),
              Text(
                excerpt,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Danh sách tin nhắn đã ghim — accordion thu gọn trong sidebar.
class _DrawerPinnedSection extends HookWidget {
  const _DrawerPinnedSection({
    required this.entries,
    required this.title,
    required this.onTap,
    required this.onUnpin,
  });

  final List<PinnedMessageEntry> entries;
  final String title;
  final ValueChanged<PinnedMessageEntry> onTap;
  final ValueChanged<PinnedMessageEntry> onUnpin;

  static String _pinnedExcerpt(String content) {
    var text = sanitizeAiChatContent(
      content,
    ).replaceAll(RegExp(r'\s+'), ' ').trim();
    text = text.replaceFirst(RegExp(r'^#{1,6}\s*'), '');
    return text;
  }

  @override
  Widget build(BuildContext context) {
    final expanded = useState(false);

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        Insets.screenH,
        0,
        Insets.screenH,
        Insets.md,
      ),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(Radii.lg),
          border: Border.all(color: AppColors.borderHairline),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () => expanded.value = !expanded.value,
                borderRadius: BorderRadius.vertical(
                  top: const Radius.circular(Radii.lg),
                  bottom: expanded.value
                      ? Radius.zero
                      : const Radius.circular(Radii.lg),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: Insets.md,
                    vertical: Insets.md,
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        LucideIcons.pin,
                        size: 16,
                        color: AppColors.primary,
                      ),
                      const Gap(Insets.sm),
                      Expanded(
                        child: Text(
                          '$title (${entries.length})',
                          style: Theme.of(context).textTheme.labelLarge
                              ?.copyWith(
                                color: AppColors.primaryDark,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                      ),
                      AnimatedRotation(
                        turns: expanded.value ? 0.5 : 0,
                        duration: Motion.fast,
                        curve: Curves.easeOutCubic,
                        child: const Icon(
                          LucideIcons.chevronDown,
                          size: 18,
                          color: AppColors.textTertiary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            AnimatedCrossFade(
              firstChild: const SizedBox.shrink(),
              secondChild: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Divider(height: 1, color: AppColors.borderHairline),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxHeight: 220),
                    child: ListView.separated(
                      shrinkWrap: true,
                      padding: EdgeInsets.zero,
                      itemCount: entries.length,
                      separatorBuilder: (_, __) => const Divider(
                        height: 1,
                        indent: Insets.md,
                        endIndent: Insets.md,
                        color: AppColors.borderHairline,
                      ),
                      itemBuilder: (context, index) {
                        final entry = entries[index];
                        final excerpt = _pinnedExcerpt(entry.message.content);
                        return ListTile(
                          dense: true,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: Insets.md,
                          ),
                          onTap: () => onTap(entry),
                          title: Text(
                            excerpt,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(fontWeight: FontWeight.w500),
                          ),
                          subtitle: Text(
                            entry.conversationTitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(color: AppColors.textTertiary),
                          ),
                          trailing: IconButton(
                            visualDensity: VisualDensity.compact,
                            icon: const Icon(
                              LucideIcons.pinOff,
                              size: 16,
                              color: AppColors.textTertiary,
                            ),
                            onPressed: () => onUnpin(entry),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
              crossFadeState: expanded.value
                  ? CrossFadeState.showSecond
                  : CrossFadeState.showFirst,
              duration: Motion.fast,
              sizeCurve: Curves.easeOutCubic,
            ),
          ],
        ),
      ),
    );
  }
}

class _ConversationGroup extends StatelessWidget {
  const _ConversationGroup({
    required this.items,
    required this.onTap,
    required this.onDelete,
    required this.onRename,
    this.activeId,
  });

  final List<AiConversation> items;
  final void Function(String id) onTap;
  final Future<void> Function(String id) onDelete;
  final Future<void> Function(String id, String title) onRename;
  final String? activeId;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(Radii.lg),
        boxShadow: Shadows.md,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(Radii.lg),
        child: Column(
          children: [
            for (int i = 0; i < items.length; i++) ...[
              Dismissible(
                key: ValueKey(items[i].id),
                direction: DismissDirection.endToStart,
                background: Container(
                  alignment: Alignment.centerRight,
                  padding: const EdgeInsets.only(right: Insets.lg),
                  color: AppColors.errorBg,
                  child: const Icon(LucideIcons.trash2, color: AppColors.error),
                ),
                confirmDismiss: (_) async {
                  await onDelete(items[i].id);
                  return true;
                },
                child: _ConversationItem(
                  item: items[i],
                  isActive: items[i].id == activeId,
                  onTap: () => onTap(items[i].id),
                  onRename: (title) => onRename(items[i].id, title),
                  onDelete: () => onDelete(items[i].id),
                ),
              ),
              if (i < items.length - 1)
                const Divider(
                  height: 1,
                  indent: Insets.lg,
                  color: AppColors.borderHairline,
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ConversationItem extends StatelessWidget {
  const _ConversationItem({
    required this.item,
    required this.onTap,
    required this.onRename,
    required this.onDelete,
    this.isActive = false,
  });

  final AiConversation item;
  final VoidCallback onTap;
  final Future<void> Function(String title) onRename;
  final Future<void> Function() onDelete;
  final bool isActive;

  Future<void> _showOptions(BuildContext context) async {
    final action = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl)),
      ),
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.symmetric(vertical: Insets.md),
              decoration: BoxDecoration(
                color: AppColors.borderStrong,
                borderRadius: BorderRadius.circular(Radii.full),
              ),
            ),
            ListTile(
              leading: const Icon(
                LucideIcons.pencil,
                color: AppColors.peacockBlue,
              ),
              title: const Text('Đổi tên'),
              onTap: () => Navigator.pop(context, 'rename'),
            ),
            ListTile(
              leading: const Icon(LucideIcons.trash2, color: AppColors.error),
              title: Text('Xoá', style: TextStyle(color: AppColors.error)),
              onTap: () => Navigator.pop(context, 'delete'),
            ),
            const Gap(Insets.sm),
          ],
        ),
      ),
    );
    if (!context.mounted) return;
    if (action == 'rename') await _showRenameDialog(context);
    if (action == 'delete') await onDelete();
  }

  Future<void> _showRenameDialog(BuildContext context) async {
    final controller = TextEditingController(text: item.title);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: const Text('Đổi tên hội thoại'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: InputDecoration(
            hintText: 'Nhập tên mới',
            filled: true,
            fillColor: AppColors.raised,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(Radii.md),
              borderSide: BorderSide.none,
            ),
          ),
          onSubmitted: (_) => Navigator.pop(ctx, true),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Huỷ'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('Lưu', style: TextStyle(color: AppColors.primary)),
          ),
        ],
      ),
    );
    if (confirmed == true && controller.text.trim().isNotEmpty) {
      await onRename(controller.text.trim());
    }
    controller.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final initials = (item.courseId ?? '??')
        .toString()
        .replaceAll(RegExp(r'\d'), '')
        .substring(
          0,
          (item.courseId ?? '??')
              .toString()
              .replaceAll(RegExp(r'\d'), '')
              .length
              .clamp(0, 3),
        )
        .toUpperCase();
    final chipBg = _courseChipColor(item.courseId?.toString());
    final chipText = _courseChipTextColor(item.courseId?.toString());

    return Material(
      color: isActive ? AppColors.primaryWash : Colors.transparent,
      child: InkWell(
        onTap: onTap,
        onLongPress: () => _showOptions(context),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: Insets.lg,
            vertical: 15,
          ),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: chipBg,
                  borderRadius: BorderRadius.circular(Radii.sm + 2),
                ),
                alignment: Alignment.center,
                child: Text(
                  initials.isEmpty ? '??' : initials,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    fontSize: 11,
                    color: chipText,
                  ),
                ),
              ),
              const Gap(Insets.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const Gap(2),
                    Text(
                      '${item.messageCount} tin nhắn'
                      '${item.lastMessageAt != null ? ' · ${formatRelativeTime(item.lastMessageAt!)}' : ''}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontSize: 12,
                        color: AppColors.textTertiary,
                      ),
                    ),
                  ],
                ),
              ),
              if (isActive) ...[
                const Gap(Insets.sm),
                const Icon(
                  LucideIcons.checkCircle2,
                  size: 18,
                  color: AppColors.primary,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _NewConversationButton extends StatelessWidget {
  const _NewConversationButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: Ink(
        height: 54,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
            colors: [Color(0xFFF8862F), Color(0xFFE8620F)],
          ),
          borderRadius: BorderRadius.circular(Radii.lg),
          boxShadow: const [
            BoxShadow(
              color: Color(0x44F37021),
              blurRadius: 28,
              offset: Offset(0, 12),
            ),
          ],
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(Radii.lg),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(LucideIcons.plus, color: Colors.white, size: 18),
              const Gap(Insets.sm),
              Text(
                label,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

void _showInChatSearch(
  BuildContext context, {
  required List<AiMessage> messages,
  required ValueChanged<String> onSelect,
}) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.card,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl)),
    ),
    builder: (sheetContext) {
      return _InChatSearchSheet(
        messages: messages,
        onSelect: (message) {
          Navigator.of(sheetContext).pop();
          onSelect(message.id);
        },
      );
    },
  );
}

class _InChatSearchSheet extends HookWidget {
  const _InChatSearchSheet({required this.messages, required this.onSelect});

  final List<AiMessage> messages;
  final ValueChanged<AiMessage> onSelect;

  @override
  Widget build(BuildContext context) {
    final query = useState('');
    final q = query.value.trim().toLowerCase();
    final matches = q.isEmpty
        ? const <AiMessage>[]
        : messages
              .where(
                (message) => sanitizeAiChatContent(
                  message.content,
                ).toLowerCase().contains(q),
              )
              .toList();

    return SafeArea(
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.72,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            Insets.screenH,
            Insets.lg,
            Insets.screenH,
            Insets.md,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Tìm trong đoạn chat',
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
              const Gap(Insets.md),
              _SearchBar(onChanged: (value) => query.value = value),
              const Gap(Insets.md),
              Expanded(
                child: q.isEmpty
                    ? Center(
                        child: Text(
                          'Nhập từ khóa để tìm trong hội thoại này.',
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(color: AppColors.textTertiary),
                          textAlign: TextAlign.center,
                        ),
                      )
                    : matches.isEmpty
                    ? const EmptyState(
                        title: 'Không tìm thấy tin nhắn',
                        message:
                            'Thử từ khóa khác trong nội dung câu hỏi hoặc câu trả lời AI.',
                      )
                    : ListView.separated(
                        itemCount: matches.length,
                        separatorBuilder: (_, __) => const Gap(Insets.sm),
                        itemBuilder: (context, index) {
                          final message = matches[index];
                          return _SearchMessageTile(
                            message: message,
                            onTap: () => onSelect(message),
                          );
                        },
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ChatScreen extends HookConsumerWidget {
  const ChatScreen({
    super.key,
    required this.conversationId,
    this.scrollToMessageId,
  });

  final String conversationId;
  final String? scrollToMessageId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final messages = ref.watch(chatControllerProvider(conversationId));
    final isPending = ref.watch(chatPendingProvider(conversationId));
    final scrollController = useScrollController();
    final messageKeys = useRef(<String, GlobalKey>{}).value;
    final courses = ref.watch(coursesControllerProvider);
    final selectedCourse = ref.watch(selectedCourseProvider);
    final scaffoldKey = useMemoized(() => GlobalKey<ScaffoldState>());
    final chatInputKey = useMemoized(() => GlobalKey<_ChatInputBarState>());

    useEffect(() {
      final opening = ref.read(tutorOpeningHandoffProvider);
      final targetId = opening?.conversationId.trim() ?? '';
      if (targetId.isNotEmpty && targetId != conversationId) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!context.mounted) return;
          context.go(AppRoutes.studentTutorChat(targetId));
        });
        return null;
      }
      if (opening?.conversationId == conversationId) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (ref.read(tutorOpeningHandoffProvider)?.conversationId ==
              conversationId) {
            ref.read(tutorOpeningHandoffProvider.notifier).state = null;
          }
        });
      }
      return null;
    }, [conversationId]);

    useEffect(() {
      void applyHandoff() {
        final handoff = ref.read(studyChatHandoffProvider);
        if (handoff == null || !context.mounted) return;
        final bar = chatInputKey.currentState;
        if (bar == null) return;
        bar.setDraft(handoff.prompt);
        ref.read(studyChatHandoffProvider.notifier).state = null;
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text(studyChatHandoffSnack)));
      }

      WidgetsBinding.instance.addPostFrameCallback((_) {
        applyHandoff();
        if (ref.read(studyChatHandoffProvider) != null) {
          Future<void>.delayed(const Duration(milliseconds: 120), applyHandoff);
        }
      });
      return null;
    }, [conversationId]);

    useEffect(() {
      var cancelled = false;
      Future<void> hydrateReviews() async {
        final stored = await loadReviewedMessageIds(
          ref.read(secureStorageProvider),
          conversationId: conversationId,
        );
        if (cancelled || stored.isEmpty) return;
        ref
            .read(reviewedMessageIdsProvider(conversationId).notifier)
            .update((ids) => {...ids, ...stored});
      }

      unawaited(hydrateReviews());
      return () => cancelled = true;
    }, [conversationId]);

    final courseItems = courses.valueOrNull ?? const [];
    final activeCourse = selectedCourse ?? courseItems.firstOrNull;
    final courseCode = activeCourse?.code ?? '—';
    final ttsScope = ttsScopeForChat(
      userId: ref.watch(authControllerProvider).valueOrNull?.userId,
      courseId: activeCourse?.id,
      courseCode: activeCourse?.code,
      classId: activeCourse?.classId,
      className: activeCourse?.className,
    );
    final ttsVoicesAsync = ref.watch(ttsVoicesProvider(ttsScope));
    final ttsVoices = ttsVoicesAsync.valueOrNull ?? const <TtsVoice>[];
    final selectedTtsVoiceId = ref.watch(ttsSelectedVoiceProvider(ttsScope));
    final resolvedTtsVoiceId = resolveTtsVoiceId(
      voices: ttsVoices,
      selectedId: selectedTtsVoiceId,
      storedId: selectedTtsVoiceId,
    );
    final ttsEnabled = ttsScope.isValid;
    final ttsVoicesError = ttsVoicesAsync.hasError
        ? describeError(ttsVoicesAsync.error!)
        : '';
    final consumedKeys = ref.watch(
      consumedSuggestionKeysProvider(conversationId),
    );
    final reviewedIds = ref.watch(reviewedMessageIdsProvider(conversationId));
    final turnNotice = ref.watch(chatTurnLimitNoticeProvider);
    final conversations = ref.watch(conversationsControllerProvider);
    final activeSession = conversations.valueOrNull
        ?.where((item) => item.id == conversationId)
        .firstOrNull;
    final quotaCourseId = activeCourse?.code.trim() ?? '';
    final dailyQuota = ref.watch(dailyQuestionQuotaProvider(quotaCourseId));
    final dailyQuotaExhausted =
        quotaCourseId.isNotEmpty && dailyQuota.exhausted;
    final questionCount = dailyQuota.used;
    final questionLimit = dailyQuota.limit;
    final maxTurnsReached = sessionMaxTurnsReached(
      activeSession,
      messages: messages.valueOrNull ?? const [],
    );
    final composerLocked = dailyQuotaExhausted || maxTurnsReached;
    final tutorSnapshot = ref.watch(tutorSessionControllerProvider);
    final revealMessageId = ref.watch(
      chatRevealMessageIdProvider(conversationId),
    );
    final mentorRequests = ref.watch(escalationHistoryControllerProvider);
    final mentorRequestingMessageId = useState<String?>(null);

    String normalizeComparableText(String? value) {
      return (value ?? '').trim().replaceAll(RegExp(r'\s+'), ' ').toLowerCase();
    }

    EscalationHistoryItem? findMentorRequest(String userQuestion) {
      final question = normalizeComparableText(userQuestion);
      if (question.isEmpty) return null;

      for (final request
          in mentorRequests.valueOrNull ?? const <EscalationHistoryItem>[]) {
        if (normalizeComparableText(request.originalQuestion) != question) {
          continue;
        }
        final requestConversationId = request.conversationId?.trim() ?? '';
        if (requestConversationId.isNotEmpty &&
            requestConversationId != conversationId) {
          continue;
        }
        final requestCourseId = request.courseId?.trim().toUpperCase() ?? '';
        final currentCourseId = activeCourse?.code.trim().toUpperCase() ?? '';
        if (requestCourseId.isNotEmpty &&
            currentCourseId.isNotEmpty &&
            requestCourseId != currentCourseId) {
          continue;
        }
        final requestClassId = request.classId?.trim().toUpperCase() ?? '';
        final currentClassId =
            activeCourse?.classId?.trim().toUpperCase() ?? '';
        if (requestClassId.isNotEmpty &&
            currentClassId.isNotEmpty &&
            requestClassId != currentClassId) {
          continue;
        }
        return request;
      }
      return null;
    }

    void scrollToMessage(String messageId) {
      final key = messageKeys[messageId];
      if (key?.currentContext == null) return;
      Scrollable.ensureVisible(
        key!.currentContext!,
        duration: Motion.base,
        curve: Curves.easeOutCubic,
        alignment: 0.2,
      );
    }

    final pendingScrollId = useRef<String?>(null);
    useEffect(() {
      final targetId = scrollToMessageId;
      if (targetId == null || targetId.isEmpty) return null;
      pendingScrollId.value = targetId;
      return null;
    }, [scrollToMessageId]);

    useEffect(() {
      final targetId = pendingScrollId.value;
      if (targetId == null || !messages.hasValue) return null;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        scrollToMessage(targetId);
        pendingScrollId.value = null;
      });
      return null;
    }, [messages.valueOrNull?.length, scrollToMessageId]);

    Future<void> downloadSource(String materialId, String title) async {
      final userId = ref.read(currentUserIdProvider);
      final course = activeCourse;
      final classId = resolveTutorClassId(
        classId: course?.classId,
        className: course?.className,
      );
      final courseId = (course?.code ?? course?.id ?? '').trim();
      if (userId.isEmpty ||
          courseId.isEmpty ||
          classId.isEmpty ||
          materialId.trim().isEmpty) {
        return;
      }
      try {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Đang tải tài liệu...')));
        final path = ref
            .read(coursesRepositoryProvider)
            .studentClassMaterialPdfApiPath(
              studentId: userId,
              courseId: courseId,
              classId: classId,
              materialId: materialId.trim(),
            );
        await openAuthenticatedApiDownload(
          ref.read(springDioProvider),
          apiPath: path,
          fileName: '${title.trim().isEmpty ? 'material' : title.trim()}.pdf',
        );
      } catch (_) {
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Không thể tải tệp. Tài liệu này có thể được nhập từ website.',
            ),
          ),
        );
      }
    }

    Future<void> sendStudyPromptInChat(
      String prompt, {
      String? displayMessage,
      String? interactionType,
      String? improvePlanId,
      String? planItemId,
      String? clickedSuggestion,
      List<String> sourceMaterialIds = const [],
      List<String> sourceChunkIds = const [],
    }) async {
      if (prompt.isEmpty || activeCourse == null) return;
      if (composerLocked) return;
      if (isPending) {
        chatInputKey.currentState?.setDraft(prompt);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text(studyChatHandoffSnack)));
        return;
      }
      final effectiveId = await ref
          .read(chatControllerProvider(conversationId).notifier)
          .sendMessage(
            conversationId: conversationId,
            message: prompt,
            courseId: activeCourse.code,
            classId: activeCourse.classId,
            displayMessage: displayMessage,
            interactionType: interactionType,
            improvePlanId: improvePlanId,
            planItemId: planItemId,
            clickedSuggestion: clickedSuggestion,
            requestedMode: 'RAG',
            sourceMaterialIds: sourceMaterialIds,
            sourceChunkIds: sourceChunkIds,
          );
      if (!context.mounted) return;
      if (effectiveId != conversationId) {
        context.go(AppRoutes.studentTutorChat(effectiveId));
      }
    }

    void handleLearnSuggestion(ImproveSuggestionItem item) {
      final text = item.effectiveText.trim().isNotEmpty
          ? item.effectiveText
          : item.title;
      unawaited(
        sendStudyPromptInChat(
          buildStudySuggestionPrompt(
            text,
            improvePlanId: item.improvePlanId,
            planItemId: item.planItemId,
          ),
          displayMessage: text,
          interactionType: item.hasImprovePlanGrounding
              ? 'IMPROVE_PLAN_REVIEW'
              : item.sourceMaterialIds.isNotEmpty
              ? 'SOURCE_BACKED_STUDY_TIP'
              : null,
          improvePlanId: item.improvePlanId,
          planItemId: item.planItemId,
          clickedSuggestion: text,
          sourceMaterialIds: item.sourceMaterialIds,
          sourceChunkIds: item.sourceChunkIds,
        ),
      );
    }

    void handleStudyTipTap(
      String tipText, {
      String currentQuestion = '',
      List<RagSourceEvidence> sourceEvidence = const [],
    }) {
      final resolved = resolveChatStudyTip(currentQuestion, tipText);
      final materialIds = sourceEvidence
          .map((item) => item.materialId?.trim() ?? '')
          .where((id) => id.isNotEmpty)
          .toSet()
          .toList();
      final chunkIds = sourceEvidence
          .map((item) => item.chunkId?.trim() ?? '')
          .where((id) => id.isNotEmpty)
          .toSet()
          .toList();
      unawaited(
        sendStudyPromptInChat(
          buildStudySuggestionPrompt(resolved),
          displayMessage: resolved,
          interactionType: materialIds.isNotEmpty
              ? 'SOURCE_BACKED_STUDY_TIP'
              : null,
          clickedSuggestion: resolved,
          sourceMaterialIds: materialIds,
          sourceChunkIds: chunkIds,
        ),
      );
    }

    Future<void> handleDeepDiveStudy(String prompt) {
      return sendStudyPromptInChat(prompt);
    }

    Future<void> handleUnderstandingCheckAnswer({
      required AiMessage message,
      required String selectedKey,
      required UnderstandingCheckAttempt attempt,
    }) async {
      await ref
          .read(chatControllerProvider(conversationId).notifier)
          .lockUnderstandingAnswer(
            conversationId: conversationId,
            message: message,
            selectedKey: selectedKey,
          );
      if (!context.mounted) return;
      if (activeCourse == null) return;

      final quiz = attempt.quiz;
      final selected = attempt.selected;
      final prompt = quiz.correctKey.isEmpty
          ? buildMissingAnswerKeyRemediationPrompt(quiz, selected)
          : attempt.isCorrect
          ? ''
          : buildIncorrectAnswerRemediationPrompt(quiz, selected);
      if (prompt.isEmpty || composerLocked) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            quiz.correctKey.isEmpty
                ? 'AI Tutor đang kiểm tra đáp án và giảng lại ngay.'
                : 'AI Tutor đang giảng lại theo cách dễ hiểu hơn.',
          ),
        ),
      );
      final effectiveId = await ref
          .read(chatControllerProvider(conversationId).notifier)
          .sendMessage(
            conversationId: conversationId,
            message: prompt,
            displayMessage: 'Giải thích lại: ${quiz.question}',
            interactionType: 'UNDERSTANDING_REMEDIATION',
            courseId: activeCourse.code,
            classId: activeCourse.classId,
          );
      if (!context.mounted) return;
      if (effectiveId != conversationId) {
        context.go(AppRoutes.studentTutorChat(effectiveId));
      }
    }

    void showReviewSubmittedSnack(String? status) {
      final message = switch (status) {
        'NEEDS_MENTOR_REVIEW' => l10n.reviewSubmittedSnackMentor,
        'NEEDS_SENIOR_REVIEW' => l10n.reviewSubmittedSnackSenior,
        _ => l10n.reviewSubmittedSnack,
      };
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
    }

    Future<void> submitMessageReview({
      required AiMessage aiMessage,
      required String userQuestion,
      required String reviewType,
      required int rating,
      required bool accurate,
      required bool helpful,
      String? feedback,
      String? suggestedCorrection,
    }) async {
      if (activeCourse == null) return;
      if (reviewedIds.contains(aiMessage.id)) return;
      try {
        final status = await ref
            .read(chatControllerProvider(conversationId).notifier)
            .submitReview(
              conversationId: conversationId,
              aiMessage: aiMessage,
              userQuestion: userQuestion,
              courseId: activeCourse.code,
              classId: activeCourse.classId,
              reviewType: reviewType,
              rating: rating,
              accurate: accurate,
              helpful: helpful,
              feedback: feedback,
              suggestedCorrection: suggestedCorrection,
            );
        if (!context.mounted) return;
        showReviewSubmittedSnack(status);
      } catch (e) {
        if (!context.mounted) return;
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(describeError(e))));
      }
    }

    Future<void> handleReviewRating(
      AiMessage aiMessage,
      String userQuestion,
      int rating,
    ) async {
      if (rating >= 4) {
        await submitMessageReview(
          aiMessage: aiMessage,
          userQuestion: userQuestion,
          reviewType: 'QUALITY_FEEDBACK',
          rating: rating,
          accurate: true,
          helpful: true,
        );
        return;
      }

      if (rating == 3) {
        await submitMessageReview(
          aiMessage: aiMessage,
          userQuestion: userQuestion,
          reviewType: 'QUALITY_FEEDBACK',
          rating: rating,
          accurate: false,
          helpful: false,
        );
        return;
      }

      final result = await showAnswerReviewFeedbackSheet(
        context,
        l10n: l10n,
        kind: AnswerReviewFeedbackKind.wrong,
      );
      if (result == null || !context.mounted) return;
      await submitMessageReview(
        aiMessage: aiMessage,
        userQuestion: userQuestion,
        reviewType: 'ANSWER_DISPUTE',
        rating: rating,
        accurate: false,
        helpful: false,
        feedback: result.feedback,
        suggestedCorrection: result.suggestedCorrection,
      );
    }

    Future<void> handleReviewReport(
      AiMessage aiMessage,
      String userQuestion,
    ) async {
      final result = await showAnswerReviewFeedbackSheet(
        context,
        l10n: l10n,
        kind: AnswerReviewFeedbackKind.reportSource,
      );
      if (result == null || !context.mounted) return;
      await submitMessageReview(
        aiMessage: aiMessage,
        userQuestion: userQuestion,
        reviewType: 'SOURCE_CONFLICT',
        rating: 1,
        accurate: false,
        helpful: false,
        feedback: result.feedback,
      );
    }

    Future<void> handleMentorReview(
      AiMessage aiMessage,
      String userQuestion,
    ) async {
      if (activeCourse == null || mentorRequestingMessageId.value != null) {
        return;
      }

      mentorRequestingMessageId.value = aiMessage.id;
      String? escalationId;
      try {
        escalationId = await ref
            .read(chatControllerProvider(conversationId).notifier)
            .requestMentorReview(
              conversationId: conversationId,
              aiMessage: aiMessage,
              userQuestion: userQuestion,
              courseId: activeCourse.code,
              classId: activeCourse.classId,
            );
        if (!context.mounted) return;
        ref.invalidate(escalationHistoryControllerProvider);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã gửi yêu cầu hỗ trợ cho mentor.')),
        );
      } catch (e) {
        if (!context.mounted) return;
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(describeError(e))));
      } finally {
        if (context.mounted) mentorRequestingMessageId.value = null;
      }

      if (context.mounted && escalationId != null) {
        context.push(AppRoutes.studentSupport(ticketId: escalationId));
      }
    }

    Future<void> showMentorReviewConfirmation(
      AiMessage aiMessage,
      String userQuestion,
    ) {
      return showModalBottomSheet<void>(
        context: context,
        backgroundColor: AppColors.card,
        isScrollControlled: true,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl)),
        ),
        builder: (sheetContext) => SafeArea(
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              Insets.screenH,
              Insets.lg,
              Insets.screenH,
              Insets.lg + MediaQuery.viewInsetsOf(sheetContext).bottom,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Icon(LucideIcons.lifeBuoy, color: AppColors.primary),
                    const Gap(Insets.sm),
                    Expanded(
                      child: Text(
                        'Gửi mentor xem xét',
                        style: Theme.of(sheetContext).textTheme.titleLarge
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Đóng',
                      onPressed: () => Navigator.of(sheetContext).pop(),
                      icon: const Icon(LucideIcons.x),
                    ),
                  ],
                ),
                const Gap(Insets.sm),
                Text(
                  'Hệ thống sẽ lưu câu hỏi, câu trả lời AI, môn học và lớp trước khi tìm mentor phù hợp.',
                  style: Theme.of(sheetContext).textTheme.bodyMedium?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
                const Gap(Insets.lg),
                Text(
                  'Câu hỏi trong AI Tutor',
                  style: Theme.of(sheetContext).textTheme.labelLarge?.copyWith(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const Gap(Insets.xs),
                FptCard(
                  outlined: true,
                  child: Text(
                    userQuestion,
                    style: Theme.of(sheetContext).textTheme.bodyLarge,
                  ),
                ),
                const Gap(Insets.lg),
                FptButton(
                  label: 'Tạo yêu cầu',
                  icon: LucideIcons.send,
                  expand: true,
                  onPressed: () {
                    Navigator.of(sheetContext).pop();
                    handleMentorReview(aiMessage, userQuestion);
                  },
                ),
              ],
            ),
          ),
        ),
      );
    }

    void handleQuizFromSuggestion(ImproveSuggestionItem item) {
      if (activeCourse == null) return;
      final topic = item.effectiveText.trim().isNotEmpty
          ? item.effectiveText
          : item.title;
      openQuizFromSuggestion(
        context,
        ref,
        courseRouteId: activeCourse.id,
        suggestionText: topic,
      );
    }

    Future<void> handlePinToggle(AiMessage message) async {
      try {
        final result = await ref
            .read(chatControllerProvider(conversationId).notifier)
            .togglePinMessage(
              conversationId: conversationId,
              messageId: message.id,
            );
        if (!context.mounted || result == null) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              result ? l10n.messagePinnedSnack : l10n.messageUnpinnedSnack,
            ),
            action: result
                ? SnackBarAction(
                    label: l10n.viewPinnedMessages,
                    onPressed: () => scaffoldKey.currentState?.openDrawer(),
                  )
                : null,
          ),
        );
      } catch (e) {
        if (!context.mounted) return;
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(describeError(e))));
      }
    }

    useEffect(() {
      if (isPending || messages.hasValue) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!scrollController.hasClients) return;
          scrollController.animateTo(
            scrollController.position.maxScrollExtent,
            duration: Motion.base,
            curve: Curves.easeOutCubic,
          );
        });
      }
      return null;
    }, [isPending, messages.valueOrNull?.length]);

    void showCoursePicker() {
      if (courseItems.isEmpty) return;
      showModalBottomSheet<void>(
        context: context,
        backgroundColor: AppColors.card,
        isScrollControlled: true,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl)),
        ),
        builder: (sheetContext) => SafeArea(
          child: SizedBox(
            height: MediaQuery.sizeOf(sheetContext).height * 0.72,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                Insets.screenH,
                Insets.lg,
                Insets.screenH,
                Insets.md,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.selectCourse,
                    style: Theme.of(sheetContext).textTheme.titleMedium,
                  ),
                  const Gap(Insets.md),
                  Expanded(
                    child: ListView.builder(
                      itemCount: courseItems.length,
                      itemBuilder: (_, index) {
                        final course = courseItems[index];
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text('${course.code} — ${course.name}'),
                          trailing: course.id == activeCourse?.id
                              ? const Icon(
                                  LucideIcons.checkCircle2,
                                  color: AppColors.primary,
                                )
                              : null,
                          onTap: () async {
                            ref.read(selectedCourseProvider.notifier).state =
                                course;
                            Navigator.of(sheetContext).pop();
                            if (course.id == activeCourse?.id) return;
                            final created = await ref
                                .read(conversationsControllerProvider.notifier)
                                .openTutorSessionOrCreate(
                                  courseId: course.code,
                                  classId: course.classId,
                                );
                            if (!context.mounted) return;
                            context.go(AppRoutes.studentTutorChat(created.id));
                          },
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      key: scaffoldKey,
      backgroundColor: AppColors.card,
      drawerScrimColor: AppColors.scrim,
      drawerEnableOpenDragGesture: true,
      drawer: ConversationHistoryDrawer(
        activeConversationId: conversationId,
        onViewPinnedMessage: scrollToMessage,
      ),
      appBar: AiChatAppBar(
        courseCode: courseCode,
        classLabel: AiChatAppBar.formatClassLabel(
          className: activeCourse?.className,
          classId: activeCourse?.classId,
        ),
        questionCount: questionCount,
        questionLimit: questionLimit,
        maxTurnsReached: dailyQuotaExhausted,
        onCourseTap: showCoursePicker,
        onHistoryTap: () => scaffoldKey.currentState?.openDrawer(),
        onSearchTap: () => _showInChatSearch(
          context,
          messages: messages.valueOrNull ?? const [],
          onSelect: scrollToMessage,
        ),
      ),
      body: Column(
        children: [
          if (turnNotice != null &&
              turnNotice.currentSessionId == conversationId)
            AiChatTurnLimitBanner(
              message: turnNotice.message,
              onOpenPrevious: () {
                context.go(
                  AppRoutes.studentTutorChat(turnNotice.previousSessionId),
                );
              },
              onDismiss: () {
                ref.read(chatTurnLimitNoticeProvider.notifier).state = null;
              },
            ),
          if (dailyQuotaExhausted)
            AiChatDailyQuotaBanner(key: ValueKey(quotaCourseId)),
          if (!dailyQuotaExhausted)
            AiChatTutorSessionStrip(
              dailyQuotaExhausted: false,
              phase: tutorSnapshot.session?.phase,
              supportLevel: tutorSnapshot.session?.supportLevel,
              status: tutorSnapshot.session?.status,
              summaryText: tutorSnapshot.summary?.summaryText,
              loading: tutorSnapshot.loading,
              onStartNext: () async {
                final opened = await ref
                    .read(tutorSessionControllerProvider.notifier)
                    .startNext();
                if (!context.mounted) return;
                final nextId = opened?.conversationId.trim() ?? '';
                if (nextId.isEmpty) return;
                context.go(AppRoutes.studentTutorChat(nextId));
              },
            ),
          Expanded(
            child: messages.when(
              loading: () => const LoadingSkeleton(itemCount: 4),
              error: (error, _) => ErrorState(
                message: describeError(error),
                onRetry: () =>
                    ref.invalidate(chatControllerProvider(conversationId)),
              ),
              data: (items) {
                const listHeaderCount = 1;
                return ListView.builder(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(
                    Insets.screenH,
                    Insets.sm,
                    Insets.screenH,
                    Insets.lg,
                  ),
                  itemCount:
                      items.length + (isPending ? 1 : 0) + listHeaderCount,
                  itemBuilder: (context, index) {
                    if (index == 0) {
                      if (items.isEmpty && !isPending) {
                        final courseHasHistory = hasStudentChattedCourse(
                          conversations.valueOrNull ?? const [],
                          courseId: activeCourse?.id,
                          courseCode: activeCourse?.code,
                        );
                        if (!courseHasHistory) {
                          return const AiChatOpeningPlaceholder();
                        }
                        return AiChatPromptStarters(
                          enabled: !isPending && !composerLocked,
                          onSelect: (prompt) {
                            final bar = chatInputKey.currentState;
                            if (bar == null) return;
                            bar.setDraft(prompt);
                            bar.sendDraft();
                          },
                        );
                      }
                      return AiChatDateSeparator(label: l10n.chatToday);
                    }

                    final msgIndex = index - listHeaderCount;
                    if (isPending && msgIndex == items.length) {
                      return const AiMessageRow(
                        isUser: false,
                        child: AiChatLoadingSteps(),
                      );
                    }

                    final message = items[msgIndex];
                    final isRetryableError =
                        !message.isUser && message.id.startsWith('err-');
                    final userQuestion = message.isUser
                        ? null
                        : ChatController.precedingUserQuestion(items, msgIndex);
                    final existingMentorRequest = userQuestion == null
                        ? null
                        : findMentorRequest(userQuestion);
                    final effectiveEscalationId =
                        (message.questionEscalationId != null &&
                            message.questionEscalationId!.isNotEmpty)
                        ? message.questionEscalationId
                        : existingMentorRequest?.id;
                    final messageKey = messageKeys.putIfAbsent(
                      message.id,
                      GlobalKey.new,
                    );
                    final extracted = message.isUser
                        ? const UnderstandingCheckExtract(before: '', after: '')
                        : resolveUnderstandingCheck(
                            markdown: message.content,
                            structured: message.understandingCheck,
                          );
                    final quiz = extracted.quiz;
                    final isWelcomeTurn = isWelcomeTutorTurn(
                      message,
                      precedingUserQuestion: userQuestion,
                    );
                    final pathSuggestions =
                        message.isUser || isRetryableError || isWelcomeTurn
                        ? const <ImproveSuggestionItem>[]
                        : () {
                            return expandImproveSuggestions(
                              chatImproveSuggestionsForMessage(
                                answer: message.content,
                                apiSuggestions: message.improveSuggestions,
                              ),
                              answer: message.content,
                            );
                          }();
                    return KeyedSubtree(
                      key: messageKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          AiMessageRow(
                            isUser: message.isUser,
                            child: ChatBubble(
                              isUser: message.isUser,
                              revealMarkdown:
                                  !message.isUser &&
                                  message.id == revealMessageId &&
                                  !isWelcomeTurn &&
                                  !isRetryableError,
                              onDownloadSource: downloadSource,
                              codeSnippet: message.codeSnippet,
                              content: quiz == null
                                  ? message.content
                                  : extracted.before,
                              afterContent: quiz == null
                                  ? null
                                  : extracted.after,
                              betweenContent: quiz == null
                                  ? null
                                  : UnderstandingCheckQuiz(
                                      quiz: quiz,
                                      lockedKey:
                                          message.understandingSelectedKey ??
                                          '',
                                      onLockAnswer: (key, attempt) {
                                        unawaited(
                                          handleUnderstandingCheckAnswer(
                                            message: message,
                                            selectedKey: key,
                                            attempt: attempt,
                                          ),
                                        );
                                      },
                                    ),
                              mode: message.mode,
                              confidence: message.confidence,
                              sources: message.sources,
                              sourceEvidence: message.sourceEvidence,
                              visualEvidence: message.visualEvidence,
                              escalated:
                                  message.escalated ||
                                  effectiveEscalationId != null,
                              pinned: message.pinned,
                              pinnedLabel: l10n.pinnedLabel,
                              onStudyTipTap: message.isUser || composerLocked
                                  ? null
                                  : (tip) => handleStudyTipTap(
                                      tip,
                                      currentQuestion: userQuestion ?? '',
                                      sourceEvidence: message.sourceEvidence,
                                    ),
                            ),
                          ),
                          if (message.isUser)
                            AiUserMessageActions(
                              canResend: !isPending && !composerLocked,
                              onCopy: () =>
                                  _copyAiAnswer(context, message.content),
                              onEdit: () {
                                chatInputKey.currentState?.setDraft(
                                  message.content,
                                );
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text(
                                      'Tin nhắn cũ vẫn được giữ trong lịch sử. Chỉnh sửa rồi gửi lại.',
                                    ),
                                  ),
                                );
                              },
                            ),
                          if (isRetryableError && userQuestion != null)
                            Padding(
                              padding: const EdgeInsets.only(
                                left: 44,
                                bottom: Insets.sm,
                              ),
                              child: Align(
                                alignment: Alignment.centerLeft,
                                child: FptButton(
                                  label: 'Thử lại',
                                  icon: LucideIcons.refreshCw,
                                  size: FptButtonSize.sm,
                                  variant: FptButtonVariant.tonal,
                                  onPressed: isPending || composerLocked
                                      ? null
                                      : () {
                                          final bar = chatInputKey.currentState;
                                          if (bar == null) return;
                                          bar.setDraft(userQuestion);
                                          bar.sendDraft();
                                        },
                                ),
                              ),
                            ),
                          if (!isRetryableError &&
                              !message.isUser &&
                              !isWelcomeTurn &&
                              userQuestion != null)
                            Padding(
                              padding: const EdgeInsets.only(
                                left: 44,
                                bottom: Insets.sm,
                              ),
                              child: Align(
                                alignment: Alignment.centerLeft,
                                child: FptButton(
                                  label: effectiveEscalationId == null
                                      ? 'Gửi mentor xem xét'
                                      : 'Mở hỗ trợ mentor',
                                  icon: LucideIcons.lifeBuoy,
                                  size: FptButtonSize.sm,
                                  variant: FptButtonVariant.tonal,
                                  loading:
                                      effectiveEscalationId == null &&
                                      mentorRequestingMessageId.value ==
                                          message.id,
                                  onPressed:
                                      mentorRequestingMessageId.value != null
                                      ? null
                                      : () {
                                          if (effectiveEscalationId != null) {
                                            context.push(
                                              AppRoutes.studentSupport(
                                                ticketId: effectiveEscalationId,
                                              ),
                                            );
                                            return;
                                          }
                                          showMentorReviewConfirmation(
                                            message,
                                            userQuestion,
                                          );
                                        },
                                ),
                              ),
                            ),
                          if (!message.isUser &&
                              !isRetryableError &&
                              ttsEnabled &&
                              message.content.trim().isNotEmpty)
                            TtsAnswerControls(
                              conversationId: conversationId,
                              messageKey: message.id,
                              messageId: message.id,
                              courseId: ttsScope.courseId,
                              classId: ttsScope.classId,
                              text: ttsSpeakableText(
                                quiz == null
                                    ? message.content
                                    : extracted.before,
                                hasEvidenceMetadata:
                                    message.sourceEvidence.isNotEmpty ||
                                    message.sources.isNotEmpty,
                              ),
                              voiceId: resolvedTtsVoiceId,
                              voices: ttsVoices,
                              voicesLoading: ttsVoicesAsync.isLoading,
                              voicesError: ttsVoicesError,
                              onVoiceChange: (voiceId) {
                                ref
                                    .read(
                                      ttsSelectedVoiceProvider(
                                        ttsScope,
                                      ).notifier,
                                    )
                                    .select(voiceId);
                              },
                            ),
                          if (!message.isUser &&
                              !isRetryableError &&
                              !isWelcomeTurn)
                            AiChatReviewBar(
                              ratingPrompt: l10n.reviewHelpfulPrompt,
                              reportLabel: l10n.reviewReport,
                              reviewSubmitted: reviewedIds.contains(message.id),
                              reviewSubmittedLabel: l10n.reviewAlreadySubmitted,
                              isPinned: message.pinned,
                              canPin: _isPersistedMessageId(message.id),
                              onCopy: () =>
                                  _copyAiAnswer(context, message.content),
                              onPin: () => handlePinToggle(message),
                              onRatingSelected: reviewedIds.contains(message.id)
                                  ? null
                                  : (rating) {
                                      final question =
                                          ChatController.precedingUserQuestion(
                                            items,
                                            msgIndex,
                                          );
                                      if (question == null) return;
                                      handleReviewRating(
                                        message,
                                        question,
                                        rating,
                                      );
                                    },
                              onReport: reviewedIds.contains(message.id)
                                  ? null
                                  : () {
                                      final question =
                                          ChatController.precedingUserQuestion(
                                            items,
                                            msgIndex,
                                          );
                                      if (question == null) return;
                                      handleReviewReport(message, question);
                                    },
                            ),
                          if (pathSuggestions.isNotEmpty)
                            ImproveSuggestionsStrip(
                              suggestions: pathSuggestions,
                              consumedKeys: consumedKeys,
                              enabled: !isPending && !composerLocked,
                              onLearn: handleLearnSuggestion,
                              onCreateQuiz: handleQuizFromSuggestion,
                            ),
                          if (!isRetryableError &&
                              !message.isUser &&
                              (userQuestion ?? '').trim().isNotEmpty &&
                              pathSuggestions.isEmpty)
                            LessonDeepDiveCta(
                              question: userQuestion!,
                              answer: message.content,
                              enabled: !isPending && !composerLocked,
                              onStudy: (prompt) {
                                unawaited(handleDeepDiveStudy(prompt));
                              },
                            ),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
          ),
          SafeArea(
            top: false,
            child: _ChatInputBar(
              key: chatInputKey,
              conversationId: conversationId,
            ),
          ),
        ],
      ),
    );
  }
}

class _ChatInputBar extends ConsumerStatefulWidget {
  const _ChatInputBar({super.key, required this.conversationId});

  final String conversationId;

  @override
  ConsumerState<_ChatInputBar> createState() => _ChatInputBarState();
}

class _ChatInputBarState extends ConsumerState<_ChatInputBar> {
  final _messageController = TextEditingController();
  final _codeController = TextEditingController();
  final _focusNode = FocusNode();
  final _speech = SpeechToText();
  final _attachments = <String>[];
  var _codeExpanded = false;
  var _listening = false;
  var _speechReady = false;
  var _speechBaseText = '';
  var _requestedMode = 'RAG';

  void setDraft(String text) {
    _messageController
      ..text = text
      ..selection = TextSelection.collapsed(offset: text.length);
    _focusNode.requestFocus();
  }

  Future<void> sendDraft() => _send();

  @override
  void initState() {
    super.initState();
    _prepareSpeech();
  }

  Future<void> _prepareSpeech() async {
    try {
      _speechReady = await _speech.initialize(
        onStatus: (status) {
          if (!mounted) return;
          if (status == SpeechToText.notListeningStatus ||
              status == SpeechToText.doneStatus) {
            setState(() => _listening = false);
          }
        },
        onError: (_) {
          if (!mounted) return;
          setState(() => _listening = false);
        },
      );
    } catch (_) {
      _speechReady = false;
    }
  }

  @override
  void dispose() {
    unawaited(_speech.stop());
    _messageController.dispose();
    _codeController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (_listening) {
      await _speech.stop();
      _listening = false;
    }
    final typed = _messageController.text.trim();
    final codeCheck = validateOptionalCodeInput(_codeController.text);
    if (!codeCheck.ok) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(codeCheck.message)));
      return;
    }
    final attachmentLine = _attachments.isEmpty
        ? ''
        : 'Em đính kèm: ${_attachments.join(', ')}.';
    final text = [
      attachmentLine,
      typed,
    ].where((part) => part.isNotEmpty).join('\n');
    if (text.isEmpty && codeCheck.value.isEmpty) return;
    final courses = ref.read(coursesControllerProvider).valueOrNull;
    final course = ref.read(selectedCourseProvider) ?? courses?.firstOrNull;
    if (course == null) return;
    final quota = ref.read(dailyQuestionQuotaProvider(course.code.trim()));
    if (quota.exhausted) return;
    _messageController.clear();
    _codeController.clear();
    setState(() {
      _attachments.clear();
      _codeExpanded = false;
    });
    final effectiveId = await ref
        .read(chatControllerProvider(widget.conversationId).notifier)
        .sendMessage(
          conversationId: widget.conversationId,
          message: text.isEmpty ? codeOnlyQuestion : text,
          courseId: course.code,
          classId: course.classId,
          codeSnippet: codeCheck.value.isEmpty ? null : codeCheck.value,
          requestedMode: _requestedMode,
        );
    if (!mounted) return;
    if (effectiveId != widget.conversationId) {
      context.go(AppRoutes.studentTutorChat(effectiveId));
    }
  }

  Future<void> _toggleMic() async {
    if (_listening) {
      await _speech.stop();
      if (mounted) setState(() => _listening = false);
      return;
    }

    if (!_speechReady) {
      await _prepareSpeech();
    }
    if (!_speechReady || !_speech.isAvailable) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Thiết bị này chưa hỗ trợ nhập bằng giọng nói hoặc chưa cấp quyền micro.',
          ),
        ),
      );
      return;
    }

    _speechBaseText = _messageController.text.trimRight();
    try {
      await _speech.listen(
        listenOptions: SpeechListenOptions(
          localeId: 'vi_VN',
          partialResults: true,
        ),
        onResult: (result) {
          if (!mounted) return;
          final transcript = result.recognizedWords.trim();
          final next = [
            _speechBaseText,
            transcript,
          ].where((part) => part.isNotEmpty).join(' ');
          _messageController.value = TextEditingValue(
            text: next,
            selection: TextSelection.collapsed(offset: next.length),
          );
        },
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Không thể bật micro. Hãy kiểm tra quyền thu âm rồi thử lại.',
          ),
        ),
      );
      return;
    }
    if (mounted) setState(() => _listening = _speech.isListening);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final isPending = ref.watch(chatPendingProvider(widget.conversationId));
    final courses = ref.read(coursesControllerProvider).valueOrNull;
    final selectedCourse = ref.watch(selectedCourseProvider);
    final activeCourse = selectedCourse ?? courses?.firstOrNull;
    final quotaCourseId = activeCourse?.code.trim() ?? '';
    final dailyQuota = ref.watch(dailyQuestionQuotaProvider(quotaCourseId));
    final dailyBlocked = quotaCourseId.isNotEmpty && dailyQuota.exhausted;
    final conversations = ref.watch(conversationsControllerProvider);
    final messages =
        ref.watch(chatControllerProvider(widget.conversationId)).valueOrNull ??
        const [];
    final activeSession = conversations.valueOrNull
        ?.where((item) => item.id == widget.conversationId)
        .firstOrNull;
    final maxTurnsReached = sessionMaxTurnsReached(
      activeSession,
      messages: messages,
    );
    final canSend =
        courses?.isNotEmpty == true &&
        !isPending &&
        !dailyBlocked &&
        !maxTurnsReached;

    return AiChatInputBar(
      controller: _messageController,
      focusNode: _focusNode,
      hint: dailyBlocked || maxTurnsReached ? '' : l10n.chatInputHint,
      enabled: canSend,
      isPending: isPending,
      isListening: _listening,
      showComposerTips: true,
      chatMode: _requestedMode,
      onChatModeChanged: (mode) {
        setState(() {
          _requestedMode = mode == 'CODE' ? 'CODE' : 'RAG';
          if (_requestedMode == 'CODE') _codeExpanded = true;
        });
      },
      attachmentNames: List.unmodifiable(_attachments),
      codeController: _codeController,
      codeExpanded: _codeExpanded,
      onToggleCode: () {
        setState(() => _codeExpanded = !_codeExpanded);
      },
      onMic: _toggleMic,
      onRemoveAttachment: (name) {
        setState(() => _attachments.remove(name));
      },
      onSend: _send,
      onStop: () => ref
          .read(chatControllerProvider(widget.conversationId).notifier)
          .cancelPendingRequest(),
      stopLabel: l10n.stopGenerating,
    );
  }
}

class CodeMentorScreen extends HookConsumerWidget {
  const CodeMentorScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final codeController = useTextEditingController();
    final questionController = useTextEditingController();
    final language = useState('dart');
    final assignmentRelated = useState(false);
    final courses = ref.watch(coursesControllerProvider);
    final selectedCourse = ref.watch(selectedCourseProvider);
    final result = ref.watch(codeMentorControllerProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: FptAppBar(title: l10n.codeMentor),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          Insets.screenH,
          Insets.screenTop,
          Insets.screenH,
          Insets.xxxl,
        ),
        children: [
          Text(
            l10n.codeMentorDisclaimer,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: AppColors.primaryDark),
          ),
          const Gap(Insets.lg),
          courses.maybeWhen(
            data: (items) {
              if (items.isEmpty) return const SizedBox.shrink();
              final unique = <Course>[];
              final seen = <String>{};
              for (final c in items) {
                if (seen.add(c.selectionKey)) unique.add(c);
              }
              final value = selectedCourse != null
                  ? unique.cast<Course?>().firstWhere(
                          (c) => c == selectedCourse,
                          orElse: () => null,
                        ) ??
                        unique.first
                  : unique.first;
              return DropdownButtonFormField<Course>(
                value: value,
                decoration: InputDecoration(labelText: l10n.selectCourse),
                items: unique
                    .map(
                      (c) => DropdownMenuItem(
                        value: c,
                        child: Text(
                          c.className != null && c.className!.isNotEmpty
                              ? '${c.code} — ${c.className}'
                              : (c.name.isNotEmpty
                                    ? '${c.code} — ${c.name}'
                                    : c.code),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    )
                    .toList(),
                onChanged: (c) {
                  if (c != null) {
                    ref.read(selectedCourseProvider.notifier).state = c;
                  }
                },
              );
            },
            orElse: () => const SizedBox.shrink(),
          ),
          const Gap(Insets.lg),
          FptTextField(
            controller: codeController,
            label: l10n.codeLabel,
            maxLines: 10,
            vietnameseInput: false,
          ),
          const Gap(Insets.lg),
          FptTextField(
            controller: questionController,
            label: l10n.questionLabel,
            maxLines: 3,
          ),
          const Gap(Insets.md),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(l10n.assignmentRelated),
            value: assignmentRelated.value,
            onChanged: (v) => assignmentRelated.value = v,
          ),
          const Gap(Insets.lg),
          FptButton(
            label: l10n.askCodeMentor,
            expand: true,
            loading: result.isLoading,
            onPressed: () async {
              final course =
                  ref.read(selectedCourseProvider) ??
                  courses.valueOrNull?.first;
              if (course == null) return;
              await ref
                  .read(codeMentorControllerProvider.notifier)
                  .ask(
                    courseId: course.code,
                    classId: course.classId,
                    question: questionController.text.trim(),
                    code: codeController.text,
                    language: language.value,
                    assignmentRelated: assignmentRelated.value,
                  );
            },
          ),
          const Gap(Insets.xl),
          result.when(
            loading: () => const LoadingSkeleton(itemCount: 2),
            error: (error, _) => ErrorState(message: describeError(error)),
            data: (answer) {
              if (answer == null) return const SizedBox.shrink();
              final extracted = resolveUnderstandingCheck(
                markdown: answer.answer,
                structured: answer.understandingCheck,
              );
              final quiz = extracted.quiz;
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (answer.assignmentSafetyApplied)
                    Container(
                      margin: const EdgeInsets.only(bottom: Insets.md),
                      padding: const EdgeInsets.all(Insets.md),
                      decoration: BoxDecoration(
                        color: AppColors.warningBg,
                        borderRadius: BorderRadius.circular(Radii.md),
                      ),
                      child: Text(
                        l10n.safetyBadge,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.warning,
                        ),
                      ),
                    ),
                  ChatBubble(
                    isUser: false,
                    content: quiz == null ? answer.answer : extracted.before,
                    afterContent: quiz == null ? null : extracted.after,
                    betweenContent: quiz == null
                        ? null
                        : UnderstandingCheckQuiz(quiz: quiz),
                    confidence: answer.confidence,
                    sources: answer.sources,
                    sourceEvidence: answer.sourceEvidence,
                    visualEvidence: answer.visualEvidence,
                  ),
                  if (answer.weakTopics.isNotEmpty) ...[
                    const Gap(Insets.md),
                    Wrap(
                      spacing: Insets.sm,
                      runSpacing: Insets.sm,
                      children: answer.weakTopics
                          .map((t) => Chip(label: Text(t)))
                          .toList(),
                    ),
                  ],
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}
