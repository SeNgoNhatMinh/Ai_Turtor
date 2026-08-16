import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_motion.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/formatters.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/models/teacher_inbox.dart';
import '../../../shared/widgets/widgets.dart';
import '../application/teacher_inbox_controller.dart';

class TeacherInboxScreen extends ConsumerStatefulWidget {
  const TeacherInboxScreen({super.key});

  @override
  ConsumerState<TeacherInboxScreen> createState() => _TeacherInboxScreenState();
}

class _TeacherInboxScreenState extends ConsumerState<TeacherInboxScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final inbox = ref.watch(teacherInboxControllerProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PortalCompactHeader.title(title: l10n.tabInbox),
          inbox.maybeWhen(
            data: (data) => Material(
              color: AppColors.card,
              child: TabBar(
                controller: _tabController,
                indicatorColor: AppColors.primary,
                labelColor: AppColors.primary,
                unselectedLabelColor: AppColors.textTertiary,
                tabs: [
                  Tab(text: _tabLabel(l10n.inboxLiveChat, data.chatUnread)),
                  Tab(
                    text: _tabLabel(
                      l10n.inboxEscalations,
                      data.escalationCount,
                    ),
                  ),
                  Tab(text: _tabLabel(l10n.inboxReviews, data.reviewCount)),
                ],
              ),
            ),
            orElse: () => const SizedBox.shrink(),
          ),
          Expanded(
            child: inbox.when(
              loading: () => const LoadingSkeleton(),
              error: (error, _) => ErrorState(
                message: describeError(error),
                onRetry: () => ref.invalidate(teacherInboxControllerProvider),
              ),
              data: (data) => TabBarView(
                controller: _tabController,
                children: [
                  _LiveChatTab(
                    items: data.liveChats,
                    onRefresh: () =>
                        ref.refresh(teacherInboxControllerProvider.future),
                  ),
                  _EscalationTab(
                    items: data.escalations,
                    onRefresh: () =>
                        ref.refresh(teacherInboxControllerProvider.future),
                  ),
                  _ReviewTab(
                    items: data.reviews,
                    onRefresh: () =>
                        ref.refresh(teacherInboxControllerProvider.future),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _tabLabel(String label, int count) {
    if (count <= 0) return label;
    return '$label ($count)';
  }
}

class _LiveChatTab extends StatelessWidget {
  const _LiveChatTab({required this.items, required this.onRefresh});

  final List<TeacherEscalationItem> items;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    if (items.isEmpty) {
      return EmptyState(
        title: l10n.emptyLiveChatTitle,
        message: l10n.emptyLiveChatMessage,
        ctaLabel: l10n.refresh,
        onCta: () => onRefresh(),
      );
    }
    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: onRefresh,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(
          Insets.screenH,
          Insets.screenTop,
          Insets.screenH,
          Insets.xxxl,
        ),
        itemCount: items.length,
        separatorBuilder: (_, __) => const Gap(Insets.md),
        itemBuilder: (context, index) {
          final item = items[index];
          return FptCard(
                onTap: () {
                  if (item.chatRoomId != null) {
                    context.push(AppRoutes.liveChat(item.chatRoomId!));
                  }
                },
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            item.studentName ?? l10n.studentFallback,
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                        ),
                        StatusPill(domain: 'escalation', value: item.status),
                      ],
                    ),
                    if (item.courseName != null) ...[
                      const Gap(Insets.xs),
                      Text(
                        item.courseName!,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                    if (item.originalQuestion != null) ...[
                      const Gap(Insets.md),
                      Text(
                        item.originalQuestion!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                    const Gap(Insets.md),
                    Row(
                      children: [
                        const Icon(
                          LucideIcons.messageSquare,
                          size: 16,
                          color: AppColors.primary,
                        ),
                        const Gap(Insets.sm),
                        Text(
                          l10n.openLiveChat,
                          style: Theme.of(context).textTheme.labelLarge
                              ?.copyWith(color: AppColors.primary),
                        ),
                      ],
                    ),
                  ],
                ),
              )
              .animate(delay: (40 * index).clamp(0, 320).ms)
              .fadeIn(duration: Motion.base);
        },
      ),
    );
  }
}

class _EscalationTab extends StatelessWidget {
  const _EscalationTab({required this.items, required this.onRefresh});

  final List<TeacherEscalationItem> items;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    if (items.isEmpty) {
      return EmptyState(
        title: l10n.emptyEscalationInboxTitle,
        message: l10n.emptyEscalationInboxMessage,
        ctaLabel: l10n.refresh,
        onCta: () => onRefresh(),
      );
    }
    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: onRefresh,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(
          Insets.screenH,
          Insets.screenTop,
          Insets.screenH,
          Insets.xxxl,
        ),
        itemCount: items.length,
        separatorBuilder: (_, __) => const Gap(Insets.md),
        itemBuilder: (context, index) {
          final item = items[index];
          return FptCard(
                onTap: () {
                  if (item.chatRoomId != null && item.chatRoomId!.isNotEmpty) {
                    context.push(AppRoutes.liveChat(item.chatRoomId!));
                    return;
                  }
                  context.push(
                    AppRoutes.teacherEscalationAnswer(item.id),
                    extra: item,
                  );
                },
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            item.studentName ?? l10n.studentFallback,
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                        ),
                        StatusPill(domain: 'escalation', value: item.status),
                      ],
                    ),
                    if (item.createdAt != null) ...[
                      const Gap(Insets.xs),
                      Text(
                        formatRelativeTime(item.createdAt!),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                    const Gap(Insets.md),
                    Text(
                      l10n.originalQuestion,
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                    const Gap(Insets.sm),
                    Text(
                      item.originalQuestion ?? '—',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    if (item.aiAnswer != null) ...[
                      const Gap(Insets.md),
                      Text(
                        l10n.aiResponseLabel,
                        style: Theme.of(context).textTheme.labelLarge,
                      ),
                      const Gap(Insets.sm),
                      Text(
                        item.aiAnswer!,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                    if (item.chatRoomId != null &&
                        item.chatRoomId!.isNotEmpty) ...[
                      const Gap(Insets.md),
                      Row(
                        children: [
                          const Icon(
                            LucideIcons.messageSquare,
                            size: 16,
                            color: AppColors.primary,
                          ),
                          const Gap(Insets.sm),
                          Text(
                            l10n.openLiveChat,
                            style: Theme.of(context).textTheme.labelLarge
                                ?.copyWith(color: AppColors.primary),
                          ),
                        ],
                      ),
                    ],
                    if (item.chatRoomId == null || item.chatRoomId!.isEmpty) ...[
                      const Gap(Insets.md),
                      Text(
                        l10n.answerEscalation,
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ],
                ),
              )
              .animate(delay: (40 * index).clamp(0, 320).ms)
              .fadeIn(duration: Motion.base);
        },
      ),
    );
  }
}

class _ReviewTab extends StatelessWidget {
  const _ReviewTab({required this.items, required this.onRefresh});

  final List<MentorPendingReview> items;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    if (items.isEmpty) {
      return EmptyState(
        title: l10n.emptyReviewQueueTitle,
        message: l10n.emptyReviewQueueMessage,
        ctaLabel: l10n.refresh,
        onCta: () => onRefresh(),
      );
    }
    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: onRefresh,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(
          Insets.screenH,
          Insets.screenTop,
          Insets.screenH,
          Insets.xxxl,
        ),
        itemCount: items.length,
        separatorBuilder: (_, __) => const Gap(Insets.md),
        itemBuilder: (context, index) {
          final item = items[index];
          return FptCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            item.studentName ?? l10n.studentFallback,
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                        ),
                        StatusPill(domain: 'review', value: item.status),
                      ],
                    ),
                    if (item.courseName != null) ...[
                      const Gap(Insets.xs),
                      Text(
                        item.courseName!,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                    if (item.isGrouped &&
                        (item.reviewCount ?? 0) > 0) ...[
                      const Gap(Insets.xs),
                      Text(
                        '${item.reviewCount} phản hồi'
                        '${item.escalationTier != null ? ' · ${item.escalationTier}' : ''}',
                        style: Theme.of(context).textTheme.labelMedium?.copyWith(
                          color: AppColors.warning,
                        ),
                      ),
                    ],
                    const Gap(Insets.md),
                    Text(
                      item.question ?? '—',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const Gap(Insets.md),
                    Text(
                      l10n.reviewQueueHint,
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall?.copyWith(color: AppColors.info),
                    ),
                  ],
                ),
              )
              .animate(delay: (40 * index).clamp(0, 320).ms)
              .fadeIn(duration: Motion.base);
        },
      ),
    );
  }
}
