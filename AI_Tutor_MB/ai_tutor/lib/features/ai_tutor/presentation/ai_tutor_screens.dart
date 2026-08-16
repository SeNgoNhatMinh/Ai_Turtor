import 'package:dio/dio.dart';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_motion.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_tokens.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/ai_chat_content.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/models/improve_suggestion.dart';
import '../../../shared/models/ai_conversation.dart';
import '../../../shared/models/course.dart';
import '../../../shared/widgets/chat_bubble.dart';
import '../../../shared/widgets/widgets.dart';
import '../../courses/application/courses_controller.dart';
import '../../memory/presentation/widgets/improve_suggestion_widgets.dart';
import '../../quiz/presentation/student_quiz_screens.dart';
import '../application/ai_tutor_controller.dart';
import 'widgets/ai_chat_widgets.dart';

/// Điểm vào tab "Ask Cóc": giống ChatGPT — bấm vào là luôn bắt đầu một
/// cuộc trò chuyện MỚI hoàn toàn, không tự mở lại đoạn chat cũ gần nhất.
///
/// Muốn xem/tiếp tục đoạn chat cũ thì mở [ConversationHistoryDrawer] (thanh
/// sidebar bên trái của [ChatScreen]) để tìm và chọn lại.
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
              .createNew(
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
        AppRoutes.studentTutorChat(
          targetConversationId,
          messageId: message.id,
        ),
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
            border: Border(
              right: BorderSide(color: AppColors.borderHairline),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  Insets.screenH,
                  Insets.md,
                  Insets.sm,
                  Insets.md,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Hội thoại',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: AppColors.splashNavy,
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Đóng',
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(
                        LucideIcons.panelLeftClose,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
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
                          separatorBuilder: (_, __) =>
                              const Gap(Insets.sm),
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

                  final now = DateTime.now();
                  final todayItems = allItems
                      .where(
                        (c) =>
                            c.lastMessageAt != null &&
                            _isToday(c.lastMessageAt!, now),
                      )
                      .toList();
                  final earlierItems = allItems
                      .where(
                        (c) =>
                            c.lastMessageAt == null ||
                            !_isToday(c.lastMessageAt!, now),
                      )
                      .toList();

                  return RefreshIndicator(
                    color: AppColors.primary,
                    onRefresh: () =>
                        ref.refresh(conversationsControllerProvider.future),
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(
                        Insets.screenH,
                        Insets.sm,
                        Insets.screenH,
                        Insets.lg,
                      ),
                      children: [
                        if (todayItems.isNotEmpty) ...[
                          _SectionLabel('HÔM NAY'),
                          const Gap(Insets.sm),
                          _ConversationGroup(
                            items: todayItems,
                            activeId: activeConversationId,
                            onTap: openConversation,
                            onDelete: (id) => ref
                                .read(conversationsControllerProvider.notifier)
                                .deleteConversation(id),
                            onRename: (id, title) => ref
                                .read(conversationsControllerProvider.notifier)
                                .renameConversation(id, title),
                          ),
                          const Gap(Insets.xl),
                        ],
                        if (earlierItems.isNotEmpty) ...[
                          _SectionLabel('TRƯỚC ĐÓ'),
                          const Gap(Insets.sm),
                          _ConversationGroup(
                            items: earlierItems,
                            activeId: activeConversationId,
                            onTap: openConversation,
                            onDelete: (id) => ref
                                .read(conversationsControllerProvider.notifier)
                                .deleteConversation(id),
                            onRename: (id, title) => ref
                                .read(conversationsControllerProvider.notifier)
                                .renameConversation(id, title),
                          ),
                        ],
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
              child: _NewConversationButton(
                label: l10n.newConversation,
                onTap: createNew,
              ),
            ),
          ],
        ),
      ),
    ),
    );
  }
}

bool _isToday(DateTime dt, DateTime now) =>
    dt.year == now.year && dt.month == now.month && dt.day == now.day;

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
    final excerpt = sanitizeAiChatContent(message.content)
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
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
    var text = sanitizeAiChatContent(content)
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
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
                            style: Theme.of(context)
                                .textTheme
                                .labelSmall
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

    final courseItems = courses.valueOrNull ?? const [];
    final activeCourse = selectedCourse ?? courseItems.firstOrNull;
    final courseCode = activeCourse?.code ?? '—';
    final consumedKeys = ref.watch(
      consumedSuggestionKeysProvider(conversationId),
    );
    final reviewedIds = ref.watch(reviewedMessageIdsProvider(conversationId));
    final learningSuggestionKey = useState<String?>(null);

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

    Future<void> handleLearnSuggestion(ImproveSuggestionItem item) async {
      if (activeCourse == null) return;
      learningSuggestionKey.value = item.key;
      try {
        await ref
            .read(chatControllerProvider(conversationId).notifier)
            .learnFromSuggestionInChat(
              conversationId: conversationId,
              courseId: activeCourse.code,
              classId: activeCourse.classId,
              suggestion: item,
            );
      } on DioException catch (e) {
        if (!context.mounted) return;
        final message = e.response?.statusCode == 409
            ? 'Gợi ý này đã được học rồi. Hãy chọn gợi ý khác hoặc hỏi câu mới.'
            : describeError(e);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(message)),
        );
      } catch (e) {
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(describeError(e))),
        );
      } finally {
        learningSuggestionKey.value = null;
      }
    }

    Future<void> handleStudyTipTap(String tipText) async {
      await handleLearnSuggestion(ImproveSuggestionItem.fromLabel(tipText));
    }

    void showReviewSubmittedSnack(String? status) {
      final message = switch (status) {
        'NEEDS_MENTOR_REVIEW' => l10n.reviewSubmittedSnackMentor,
        'NEEDS_SENIOR_REVIEW' => l10n.reviewSubmittedSnackSenior,
        _ => l10n.reviewSubmittedSnack,
      };
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(describeError(e))),
        );
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

    void handleQuizFromSuggestion(ImproveSuggestionItem item) {
      if (activeCourse == null) return;
      Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => TakeQuizScreen(
            courseId: activeCourse.id,
            topic: item.effectiveTopic,
            suggestionText: item.effectiveText,
          ),
        ),
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
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl)),
        ),
        builder: (_) => Padding(
          padding: const EdgeInsets.fromLTRB(
            Insets.screenH,
            Insets.lg,
            Insets.screenH,
            Insets.xxxl,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l10n.selectCourse,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const Gap(Insets.md),
              ...courseItems.map(
                (c) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('${c.code} — ${c.name}'),
                  trailing: c.id == activeCourse?.id
                      ? const Icon(
                          LucideIcons.checkCircle2,
                          color: AppColors.primary,
                        )
                      : null,
                  onTap: () async {
                    ref.read(selectedCourseProvider.notifier).state = c;
                    Navigator.of(context).pop();
                    if (c.id == activeCourse?.id) return;
                    final created = await ref
                        .read(conversationsControllerProvider.notifier)
                        .createNew(
                          courseId: c.code,
                          classId: c.classId,
                        );
                    if (!context.mounted) return;
                    context.go(AppRoutes.studentTutorChat(created.id));
                  },
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      key: scaffoldKey,
      backgroundColor: AppColors.canvas,
      drawerScrimColor: AppColors.scrim,
      drawerEnableOpenDragGesture: true,
      drawer: ConversationHistoryDrawer(
        activeConversationId: conversationId,
        onViewPinnedMessage: scrollToMessage,
      ),
      appBar: AiChatAppBar(
        courseCode: courseCode,
        onCourseTap: showCoursePicker,
        onHistoryTap: () => scaffoldKey.currentState?.openDrawer(),
      ),
      body: Column(
        children: [
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
                      return AiChatDateSeparator(label: l10n.chatToday);
                    }

                    final msgIndex = index - listHeaderCount;
                    if (isPending && msgIndex == items.length) {
                      return AiMessageRow(
                        isUser: false,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            vertical: Insets.sm,
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                l10n.aiThinking,
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(color: AppColors.textTertiary),
                              ),
                              const Gap(Insets.xs),
                              const TypingDots(),
                            ],
                          ),
                        ),
                      );
                    }

                    final message = items[msgIndex];
                    final messageKey = messageKeys.putIfAbsent(
                      message.id,
                      GlobalKey.new,
                    );
                    return KeyedSubtree(
                      key: messageKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          AiMessageRow(
                            isUser: message.isUser,
                            child: ChatBubble(
                              isUser: message.isUser,
                              content: message.content,
                              mode: message.mode,
                              confidence: message.confidence,
                              sources: message.sources,
                              sourceEvidence: message.sourceEvidence,
                              visualEvidence: message.visualEvidence,
                              escalated: message.escalated,
                              pinned: message.pinned,
                              pinnedLabel: l10n.pinnedLabel,
                              onStudyTipTap: message.isUser
                                  ? null
                                  : handleStudyTipTap,
                              trailing:
                                  message.questionEscalationId != null &&
                                      message.questionEscalationId!.isNotEmpty
                                  ? FptButton(
                                      label: l10n.requestMentorSupport,
                                      size: FptButtonSize.sm,
                                      variant: FptButtonVariant.tonal,
                                      onPressed: () => context.push(
                                        AppRoutes.escalationOffer(
                                          message.questionEscalationId!,
                                        ),
                                      ),
                                    )
                                  : null,
                            ),
                          ),
                          if (!message.isUser)
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
                          if (!message.isUser &&
                              message.improveSuggestions.isNotEmpty)
                            ImproveSuggestionsStrip(
                              suggestions: message.improveSuggestions,
                              answerMarkdown: message.content,
                              consumedKeys: consumedKeys,
                              loadingKey: learningSuggestionKey.value,
                              onLearn: handleLearnSuggestion,
                              onCreateQuiz: handleQuizFromSuggestion,
                            ),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
          ),
          _ChatInputBar(conversationId: conversationId),
        ],
      ),
    );
  }
}

class _ChatInputBar extends ConsumerStatefulWidget {
  const _ChatInputBar({required this.conversationId});

  final String conversationId;

  @override
  ConsumerState<_ChatInputBar> createState() => _ChatInputBarState();
}

class _ChatInputBarState extends ConsumerState<_ChatInputBar> {
  final _messageController = TextEditingController();

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;
    final courses = ref.read(coursesControllerProvider).valueOrNull;
    final course = ref.read(selectedCourseProvider) ?? courses?.firstOrNull;
    if (course == null) return;
    _messageController.clear();
    final effectiveId = await ref
        .read(chatControllerProvider(widget.conversationId).notifier)
        .sendMessage(
          conversationId: widget.conversationId,
          message: text,
          courseId: course.code,
          classId: course.classId,
        );
    if (!mounted) return;
    if (effectiveId != widget.conversationId) {
      context.go(AppRoutes.studentTutorChat(effectiveId));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final isPending = ref.watch(chatPendingProvider(widget.conversationId));
    final dailyBlocked = ref.watch(studentDailyQuestionBlockedProvider);
    final courses = ref.read(coursesControllerProvider).valueOrNull;
    final canSend = courses?.isNotEmpty == true && !isPending && !dailyBlocked;

    return AiChatInputBar(
      controller: _messageController,
      hint: dailyBlocked
          ? 'Đã hết lượt hỏi AI hôm nay (giới hạn theo ngày).'
          : l10n.chatInputHint,
      enabled: canSend,
      isPending: isPending,
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
              final selectedId = selectedCourse?.id ?? items.first.id;
              final value = items.firstWhere(
                (c) => c.id == selectedId,
                orElse: () => items.first,
              );
              return DropdownButtonFormField<Course>(
                value: value,
                decoration: InputDecoration(labelText: l10n.selectCourse),
                items: items
                    .map((c) => DropdownMenuItem(value: c, child: Text(c.name)))
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
                    content: answer.answer,
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
