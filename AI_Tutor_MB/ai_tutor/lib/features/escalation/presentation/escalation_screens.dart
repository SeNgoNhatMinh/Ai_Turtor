import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/router/router_helpers.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_motion.dart';
import '../../../core/theme/app_tokens.dart';
import '../../../core/utils/ai_chat_content.dart';
import '../../../core/utils/formatters.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/models/escalation.dart';
import '../../../shared/models/live_chat.dart';
import '../../../shared/widgets/chat_bubble.dart';
import '../../../shared/widgets/widgets.dart';
import '../../ai_tutor/presentation/widgets/ai_chat_widgets.dart';
import '../../auth/application/auth_controller.dart';
import '../application/escalation_controller.dart';
import '../data/mentor_support.dart';

class LiveChatScreen extends HookConsumerWidget {
  const LiveChatScreen({
    super.key,
    required this.chatRoomId,
    this.mentorId,
    this.initialMentorOnline,
  });

  final String chatRoomId;
  final String? mentorId;
  final bool? initialMentorOnline;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final messageController = useTextEditingController();
    final contextExpanded = useState(false);
    final sending = useState(false);
    final scrollController = useScrollController();
    final chatRequest = (
      chatRoomId: chatRoomId,
      mentorId: mentorId,
      mentorOnline: initialMentorOnline,
    );
    final chat = ref.watch(liveChatControllerProvider(chatRequest));
    final session = ref.watch(authControllerProvider).valueOrNull;

    void leaveLiveChat() {
      context.leaveLiveChat(role: session?.role);
    }

    void scrollToBottom() {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!scrollController.hasClients) return;
        scrollController.animateTo(
          scrollController.position.maxScrollExtent,
          duration: Motion.base,
          curve: Curves.easeOutCubic,
        );
      });
    }

    useEffect(() {
      scrollToBottom();
      return null;
    }, [chat.valueOrNull?.messages.length]);

    useEffect(() {
      void onResume() {
        ref.read(liveChatControllerProvider(chatRequest).notifier).reload();
      }

      final observer = _LiveChatLifecycleObserver(onResume: onResume);
      WidgetsBinding.instance.addObserver(observer);
      return () => WidgetsBinding.instance.removeObserver(observer);
    }, [chatRequest]);

    Future<void> handleSend() async {
      final text = messageController.text.trim();
      if (text.isEmpty || sending.value) return;
      messageController.clear();
      sending.value = true;
      try {
        await ref
            .read(liveChatControllerProvider(chatRequest).notifier)
            .sendMessage(text);
      } catch (error) {
        if (context.mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text(describeError(error))));
        }
      } finally {
        sending.value = false;
      }
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) leaveLiveChat();
      },
      child: Scaffold(
        backgroundColor: AppColors.canvas,
        appBar: chat.maybeWhen(
          data: (data) => _LiveChatAppBar(
            mentorName: data.detail.mentorName ?? l10n.liveChatTitle,
            mentorAvatarUrl: data.detail.mentorAvatarUrl,
            onlineLabel: mentorPresenceLabel(data.mentorOnline),
            isLive: data.mentorOnline == true,
            onBack: leaveLiveChat,
            onClose: data.detail.isReadOnly
                ? null
                : () => _showCloseSheet(
                    context,
                    ref,
                    chatRequest,
                    role: session?.role,
                  ),
          ),
          orElse: () => _LiveChatAppBar(
            mentorName: l10n.liveChatTitle,
            onlineLabel: 'Đang đồng bộ',
            isLive: false,
            onBack: leaveLiveChat,
          ),
        ),
        body: chat.when(
          loading: () => const LoadingSkeleton(itemCount: 4),
          error: (error, _) => ErrorState(
            message: describeError(error),
            onRetry: () =>
                ref.invalidate(liveChatControllerProvider(chatRequest)),
          ),
          data: (data) {
            final readOnly = data.detail.isReadOnly;
            final aiPreview = data.detail.aiAnswer == null
                ? null
                : sanitizeEscalationAiPreview(data.detail.aiAnswer!);

            return Column(
              children: [
                if (readOnly)
                  Container(
                    width: double.infinity,
                    color: AppColors.warm100,
                    padding: const EdgeInsets.symmetric(
                      horizontal: Insets.lg,
                      vertical: Insets.sm,
                    ),
                    child: Text(
                      l10n.chatRoomClosed,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                if (data.detail.originalQuestion != null)
                  _LiveChatContextPanel(
                    expanded: contextExpanded.value,
                    onToggle: () =>
                        contextExpanded.value = !contextExpanded.value,
                    contextLabel: l10n.escalationContext,
                    questionLabel: l10n.originalQuestion,
                    aiPreviewLabel: l10n.liveChatAiPreviewLabel,
                    question: data.detail.originalQuestion!,
                    aiPreview: aiPreview,
                  ),
                Expanded(
                  child: data.messages.isEmpty
                      ? EmptyState(
                          title: l10n.liveChatEmptyTitle,
                          message: l10n.liveChatEmptyMessage,
                        )
                      : ListView.builder(
                          controller: scrollController,
                          padding: const EdgeInsets.fromLTRB(
                            Insets.screenH,
                            Insets.sm,
                            Insets.screenH,
                            Insets.lg,
                          ),
                          itemCount: data.messages.length + 1,
                          itemBuilder: (context, index) {
                            if (index == 0) {
                              return AiChatDateSeparator(label: l10n.chatToday);
                            }
                            final message = data.messages[index - 1];
                            if (message.isSystem) {
                              return Padding(
                                padding: const EdgeInsets.symmetric(
                                  vertical: Insets.sm,
                                ),
                                child: Center(
                                  child: Text(
                                    message.content,
                                    style: Theme.of(context).textTheme.bodySmall
                                        ?.copyWith(
                                          color: AppColors.textTertiary,
                                        ),
                                  ),
                                ),
                              );
                            }
                            return _LiveChatMessageRow(
                              message: message,
                              mentorName: data.detail.mentorName,
                              mentorAvatarUrl: data.detail.mentorAvatarUrl,
                            );
                          },
                        ),
                ),
                if (!readOnly)
                  AiChatInputBar(
                    controller: messageController,
                    hint: l10n.liveChatInputHint,
                    enabled: !sending.value,
                    isPending: sending.value,
                    onSend: handleSend,
                    onStop: () {},
                    stopLabel: l10n.stopGenerating,
                  ),
              ],
            );
          },
        ),
      ),
    );
  }

  Future<void> _showCloseSheet(
    BuildContext screenContext,
    WidgetRef ref,
    LiveChatRequest chatRequest, {
    String? role,
  }) async {
    final l10n = AppLocalizations.of(screenContext)!;
    var rating = 5;
    final feedbackController = TextEditingController();

    await showModalBottomSheet<void>(
      context: screenContext,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            return Padding(
              padding: const EdgeInsets.all(Insets.xl),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.closeChatTitle,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const Gap(Insets.md),
                  Text(
                    l10n.rateMentor,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const Gap(Insets.sm),
                  Row(
                    children: List.generate(5, (i) {
                      final star = i + 1;
                      return IconButton(
                        onPressed: () => setState(() => rating = star),
                        icon: Icon(
                          LucideIcons.star,
                          color: star <= rating
                              ? AppColors.warning
                              : AppColors.warm300,
                        ),
                      );
                    }),
                  ),
                  FptTextField(
                    controller: feedbackController,
                    label: l10n.feedbackLabel,
                    maxLines: 3,
                  ),
                  const Gap(Insets.lg),
                  FptButton(
                    label: l10n.closeChatConfirm,
                    expand: true,
                    onPressed: () async {
                      await ref
                          .read(
                            liveChatControllerProvider(chatRequest).notifier,
                          )
                          .closeRoom(
                            rating: rating,
                            feedback: feedbackController.text.trim().isEmpty
                                ? null
                                : feedbackController.text.trim(),
                          );
                      if (screenContext.mounted) {
                        Navigator.pop(context);
                        screenContext.leaveLiveChat(role: role);
                      }
                    },
                  ),
                ],
              ),
            );
          },
        );
      },
    );
    feedbackController.dispose();
  }
}

class _LiveChatLifecycleObserver with WidgetsBindingObserver {
  _LiveChatLifecycleObserver({required this.onResume});

  final VoidCallback onResume;

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      onResume();
    }
  }
}

String mentorPresenceLabel(bool? online) {
  return switch (online) {
    true => 'Online',
    false => 'Offline',
    null => 'Chưa rõ trạng thái',
  };
}

class _LiveChatAppBar extends StatelessWidget implements PreferredSizeWidget {
  const _LiveChatAppBar({
    required this.mentorName,
    required this.onlineLabel,
    required this.onBack,
    this.isLive = false,
    this.mentorAvatarUrl,
    this.onClose,
  });

  final String mentorName;
  final String onlineLabel;
  final bool isLive;
  final VoidCallback onBack;
  final String? mentorAvatarUrl;
  final VoidCallback? onClose;

  @override
  Size get preferredSize => const Size.fromHeight(64);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      backgroundColor: AppColors.card,
      elevation: 0,
      scrolledUnderElevation: 0,
      leading: IconButton(
        icon: const Icon(LucideIcons.arrowLeft, color: AppColors.textSecondary),
        onPressed: onBack,
      ),
      titleSpacing: 0,
      title: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: AppColors.primaryWash,
            backgroundImage: mentorAvatarUrl != null
                ? NetworkImage(mentorAvatarUrl!)
                : null,
            child: mentorAvatarUrl == null
                ? Text(
                    mentorName.isNotEmpty ? mentorName[0].toUpperCase() : '?',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: AppColors.primaryDark,
                      fontWeight: FontWeight.w700,
                    ),
                  )
                : null,
          ),
          const Gap(Insets.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  mentorName,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: AppColors.splashNavy,
                    fontSize: 16,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Row(
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(
                        color: isLive
                            ? AppColors.leafGreen
                            : AppColors.textTertiary,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const Gap(Insets.xs),
                    Text(
                      onlineLabel,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textTertiary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
      actions: [
        if (onClose != null)
          IconButton(
            tooltip: 'Đóng phòng chat',
            onPressed: onClose,
            icon: const Icon(LucideIcons.x, color: AppColors.primary),
          ),
      ],
      bottom: const PreferredSize(
        preferredSize: Size.fromHeight(1),
        child: Divider(height: 1, color: AppColors.borderHairline),
      ),
    );
  }
}

class _LiveChatContextPanel extends StatelessWidget {
  const _LiveChatContextPanel({
    required this.expanded,
    required this.onToggle,
    required this.contextLabel,
    required this.questionLabel,
    required this.aiPreviewLabel,
    required this.question,
    this.aiPreview,
  });

  final bool expanded;
  final VoidCallback onToggle;
  final String contextLabel;
  final String questionLabel;
  final String aiPreviewLabel;
  final String question;
  final String? aiPreview;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Material(
      color: AppColors.card,
      child: InkWell(
        onTap: onToggle,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(
            Insets.screenH,
            Insets.sm,
            Insets.screenH,
            Insets.sm,
          ),
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: AppColors.borderHairline)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(
                    LucideIcons.fileText,
                    size: 16,
                    color: AppColors.textTertiary,
                  ),
                  const Gap(Insets.sm),
                  Expanded(
                    child: Text(
                      expanded ? contextLabel : question,
                      style: textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: expanded ? 1 : 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Icon(
                    expanded ? LucideIcons.chevronUp : LucideIcons.chevronDown,
                    size: 18,
                    color: AppColors.textTertiary,
                  ),
                ],
              ),
              if (expanded) ...[
                const Gap(Insets.sm),
                Text(
                  questionLabel,
                  style: textTheme.bodySmall?.copyWith(
                    color: AppColors.textTertiary,
                  ),
                ),
                const Gap(Insets.xs),
                Text(question, style: textTheme.bodyLarge),
                if (aiPreview != null && aiPreview!.isNotEmpty) ...[
                  const Gap(Insets.md),
                  Text(
                    aiPreviewLabel,
                    style: textTheme.bodySmall?.copyWith(
                      color: AppColors.textTertiary,
                    ),
                  ),
                  const Gap(Insets.xs),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(Insets.md),
                    decoration: BoxDecoration(
                      color: AppColors.infoBg,
                      borderRadius: BorderRadius.circular(Radii.md),
                      border: Border.all(color: AppColors.borderHairline),
                    ),
                    child: Text(
                      aiPreview!,
                      style: textTheme.bodyMedium?.copyWith(
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                ],
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _LiveChatMessageRow extends StatelessWidget {
  const _LiveChatMessageRow({
    required this.message,
    this.mentorName,
    this.mentorAvatarUrl,
  });

  final LiveChatMessage message;
  final String? mentorName;
  final String? mentorAvatarUrl;

  @override
  Widget build(BuildContext context) {
    if (message.isUser) {
      return Align(
        alignment: Alignment.centerRight,
        child: ChatBubble(
          isUser: true,
          content: message.content,
          useMarkdown: false,
        ),
      );
    }

    final name = mentorName ?? 'Mentor';
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        CircleAvatar(
          radius: 16,
          backgroundColor: AppColors.primaryWash,
          backgroundImage: mentorAvatarUrl != null
              ? NetworkImage(mentorAvatarUrl!)
              : null,
          child: mentorAvatarUrl == null
              ? Text(
                  name.isNotEmpty ? name[0].toUpperCase() : 'M',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: AppColors.primaryDark,
                    fontWeight: FontWeight.w700,
                  ),
                )
              : null,
        ),
        const Gap(Insets.sm),
        Expanded(
          child: ChatBubble(
            isUser: false,
            content: message.content,
            useMarkdown: false,
          ),
        ),
      ],
    );
  }
}

class EscalationHistoryScreen extends HookConsumerWidget {
  const EscalationHistoryScreen({super.key, this.ticketId});

  final String? ticketId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedTicketId = ticketId?.trim();
    if (selectedTicketId != null && selectedTicketId.isNotEmpty) {
      return _SupportTicketDetailView(ticketId: selectedTicketId);
    }
    return const _SupportTicketInboxView();
  }
}

class _SupportTicketInboxView extends HookConsumerWidget {
  const _SupportTicketInboxView();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final history = ref.watch(escalationHistoryControllerProvider);
    final query = useState('');
    final filter = useState(SupportTicketFilter.all);

    return Scaffold(
      backgroundColor: AppColors.canvas,
      appBar: FptAppBar(title: l10n.escalationHistoryTitle),
      body: history.when(
        loading: () => const LoadingSkeleton(),
        error: (error, _) => ErrorState(
          message: describeError(error),
          onRetry: () => ref.invalidate(escalationHistoryControllerProvider),
        ),
        data: (items) {
          if (items.isEmpty) {
            return EmptyState(
              title: l10n.emptyEscalationHistoryTitle,
              message: l10n.emptyEscalationHistoryMessage,
            );
          }

          final counts = supportTicketCounts(items);
          final filtered = filterSupportTickets(
            items,
            filter: filter.value,
            query: query.value,
          );

          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () =>
                ref.refresh(escalationHistoryControllerProvider.future),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                Insets.screenH,
                Insets.screenTop,
                Insets.screenH,
                Insets.xxxl,
              ),
              children: [
                Text(
                  'Trung tâm hỗ trợ học tập',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const Gap(Insets.xs),
                Text(
                  'Chọn một yêu cầu để xem tiến trình và trao đổi với giảng viên.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
                const Gap(Insets.md),
                Row(
                  children: [
                    Expanded(
                      child: _SupportCountChip(
                        icon: LucideIcons.clock,
                        label: '${counts.waiting} đang xử lý',
                      ),
                    ),
                    const Gap(Insets.sm),
                    Expanded(
                      child: _SupportCountChip(
                        icon: LucideIcons.circleCheck,
                        label: '${counts.answered} đã phản hồi',
                      ),
                    ),
                  ],
                ),
                const Gap(Insets.md),
                FptTextField(
                  hint: 'Tìm theo câu hỏi, môn hoặc lớp',
                  prefixIcon: const Icon(LucideIcons.search, size: 18),
                  onChanged: (value) => query.value = value,
                ),
                const Gap(Insets.sm),
                Wrap(
                  spacing: Insets.sm,
                  runSpacing: Insets.sm,
                  children: [
                    _SupportFilterChip(
                      label: 'Tất cả',
                      count: counts.all,
                      selected: filter.value == SupportTicketFilter.all,
                      onTap: () => filter.value = SupportTicketFilter.all,
                    ),
                    _SupportFilterChip(
                      label: 'Đang xử lý',
                      count: counts.waiting,
                      selected: filter.value == SupportTicketFilter.waiting,
                      onTap: () => filter.value = SupportTicketFilter.waiting,
                    ),
                    _SupportFilterChip(
                      label: 'Đã phản hồi',
                      count: counts.answered,
                      selected: filter.value == SupportTicketFilter.answered,
                      onTap: () => filter.value = SupportTicketFilter.answered,
                    ),
                  ],
                ),
                const Gap(Insets.md),
                if (filtered.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: Insets.xl),
                    child: EmptyState(
                      title: 'Không tìm thấy yêu cầu phù hợp',
                      message: 'Thử đổi từ khóa hoặc bộ lọc trạng thái.',
                    ),
                  )
                else
                  ...filtered.map(
                    (item) => Padding(
                      padding: const EdgeInsets.only(bottom: Insets.md),
                      child: _SupportTicketCard(
                        ticket: item,
                        onTap: () => context.push(
                          AppRoutes.studentSupport(ticketId: item.id),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _SupportTicketDetailView extends ConsumerWidget {
  const _SupportTicketDetailView({required this.ticketId});

  final String ticketId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.watch(escalationHistoryControllerProvider);
    final detail = ref.watch(escalationDetailControllerProvider(ticketId));
    final summary = findSupportTicket(
      history.valueOrNull ?? const [],
      ticketId,
    );
    final ticket = detail.valueOrNull?.merge(summary) ?? summary;
    final loadError = detail.hasError && ticket == null
        ? describeError(detail.error!)
        : null;

    void closeDetail() {
      if (context.canPop()) {
        context.pop();
        return;
      }
      context.go(AppRoutes.escalationHistory);
    }

    return Scaffold(
      backgroundColor: AppColors.canvas,
      appBar: FptAppBar(
        title: 'Chi tiết yêu cầu',
        leading: PortalBackButton(onPressed: closeDetail),
      ),
      body: ticket == null
          ? (loadError != null
                ? ErrorState(
                    message: loadError,
                    onRetry: () => ref.invalidate(
                      escalationDetailControllerProvider(ticketId),
                    ),
                  )
                : const LoadingSkeleton(itemCount: 3))
          : RefreshIndicator(
              color: AppColors.primary,
              onRefresh: () async {
                await Future.wait([
                  ref.refresh(
                    escalationDetailControllerProvider(ticketId).future,
                  ),
                  ref.refresh(escalationHistoryControllerProvider.future),
                ]);
              },
              child: ListView(
                padding: const EdgeInsets.fromLTRB(
                  Insets.screenH,
                  Insets.screenTop,
                  Insets.screenH,
                  Insets.xxxl,
                ),
                children: [
                  Text(
                    'Chi tiết yêu cầu',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const Gap(Insets.xs),
                  Text(
                    getQuestionText(ticket),
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const Gap(Insets.xs),
                  Text(
                    'Theo dõi câu trả lời và trao đổi trực tiếp với giảng viên.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const Gap(Insets.sm),
                  Wrap(
                    spacing: Insets.sm,
                    runSpacing: Insets.sm,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      if (ticket.courseId != null &&
                          ticket.courseId!.isNotEmpty)
                        Text(
                          'Môn ${ticket.courseId}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      if (ticket.classId != null && ticket.classId!.isNotEmpty)
                        Text(
                          'Lớp ${ticket.classId}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      if (getAssignedMentor(ticket).isNotEmpty)
                        Text(
                          'Giảng viên ${getAssignedMentor(ticket)}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      StatusPill(
                        domain: 'escalation',
                        value: getSupportTicketStatus(ticket),
                      ),
                    ],
                  ),
                  if (detail.hasError) ...[
                    const Gap(Insets.md),
                    Text(
                      'Không thể tải đầy đủ yêu cầu. ${describeError(detail.error!)}',
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall?.copyWith(color: AppColors.warning),
                    ),
                  ],
                  if (detail.isLoading && detail.valueOrNull == null) ...[
                    const Gap(Insets.md),
                    Text(
                      'Đang tải nội dung đầy đủ...',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                  if (getAiSnapshot(ticket).isNotEmpty) ...[
                    const Gap(Insets.lg),
                    _SupportReviewBlock(
                      label: 'Câu trả lời AI trước đó',
                      icon: LucideIcons.sparkles,
                      child: ChatBubble(
                        isUser: false,
                        content: getAiSnapshot(ticket),
                      ),
                    ),
                  ],
                  if (getMentorAnswer(ticket).isNotEmpty) ...[
                    const Gap(Insets.md),
                    _SupportReviewBlock(
                      label: getAssignedMentor(ticket).isNotEmpty
                          ? 'Câu trả lời từ ${getAssignedMentor(ticket)}'
                          : 'Câu trả lời của giảng viên',
                      icon: LucideIcons.graduationCap,
                      child: Text(
                        getMentorAnswer(ticket),
                        style: Theme.of(context).textTheme.bodyLarge,
                      ),
                    ),
                  ] else if (isLiveChatTicket(ticket) &&
                      ticket.chatRoomId != null &&
                      ticket.chatRoomId!.isNotEmpty) ...[
                    const Gap(Insets.lg),
                    FptButton(
                      label: 'Tiếp tục trò chuyện',
                      icon: LucideIcons.messageCircle,
                      onPressed: () =>
                          context.push(AppRoutes.liveChat(ticket.chatRoomId!)),
                    ),
                  ] else if (canOpenMentorOffer(ticket)) ...[
                    const Gap(Insets.lg),
                    FptButton(
                      label: 'Chọn giảng viên',
                      icon: LucideIcons.userPlus,
                      onPressed: () =>
                          context.push(AppRoutes.escalationOffer(ticket.id)),
                    ),
                    const Gap(Insets.sm),
                    Text(
                      'Hệ thống cần tìm giảng viên phụ trách môn/lớp, sau đó bạn chọn giảng viên để mở cuộc trò chuyện hai chiều.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ] else if (isProcessingTicket(ticket)) ...[
                    const Gap(Insets.lg),
                    FptCard(
                      outlined: true,
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(
                            LucideIcons.clock,
                            color: AppColors.primary,
                          ),
                          const Gap(Insets.sm),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Đang chờ bắt đầu hỗ trợ',
                                  style: Theme.of(context).textTheme.titleSmall
                                      ?.copyWith(fontWeight: FontWeight.w700),
                                ),
                                const Gap(Insets.xs),
                                Text(
                                  'Hệ thống cần tìm giảng viên phụ trách môn/lớp, sau đó bạn chọn giảng viên để mở cuộc trò chuyện hai chiều.',
                                  style: Theme.of(context).textTheme.bodySmall
                                      ?.copyWith(
                                        color: AppColors.textSecondary,
                                      ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
    );
  }
}

class _SupportTicketCard extends StatelessWidget {
  const _SupportTicketCard({required this.ticket, required this.onTap});

  final EscalationHistoryItem ticket;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final answered = isAnsweredTicket(ticket);
    final when = ticket.updatedAt ?? ticket.createdAt;
    final meta = [
      if (ticket.courseId != null && ticket.courseId!.isNotEmpty)
        'Môn ${ticket.courseId}',
      if (ticket.classId != null && ticket.classId!.isNotEmpty)
        'Lớp ${ticket.classId}',
    ];

    return FptCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(top: 7),
                decoration: BoxDecoration(
                  color: answered ? AppColors.success : AppColors.warning,
                  shape: BoxShape.circle,
                ),
              ),
              const Gap(Insets.sm),
              Expanded(
                child: Text(
                  getQuestionText(ticket),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const Gap(Insets.sm),
          Wrap(
            spacing: Insets.md,
            runSpacing: Insets.xs,
            children: [
              if (when != null)
                Text(
                  formatRelativeTime(when),
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ...meta.map(
                (item) =>
                    Text(item, style: Theme.of(context).textTheme.bodySmall),
              ),
            ],
          ),
          const Gap(Insets.sm),
          Row(
            children: [
              StatusPill(
                domain: 'escalation',
                value: getSupportTicketStatus(ticket),
              ),
              const Spacer(),
              Text(
                'Xem chi tiết →',
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SupportFilterChip extends StatelessWidget {
  const _SupportFilterChip({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AppColors.primaryWash : AppColors.raised,
      borderRadius: BorderRadius.circular(Radii.full),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(Radii.full),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: Insets.md,
            vertical: Insets.sm,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: selected ? AppColors.primary : AppColors.textSecondary,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Gap(Insets.xs),
              Text(
                '$count',
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: selected ? AppColors.primary : AppColors.textTertiary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SupportCountChip extends StatelessWidget {
  const _SupportCountChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return FptCard(
      outlined: true,
      child: Row(
        children: [
          Icon(icon, size: 16, color: AppColors.primary),
          const Gap(Insets.sm),
          Expanded(
            child: Text(
              label,
              style: Theme.of(
                context,
              ).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

class _SupportReviewBlock extends StatelessWidget {
  const _SupportReviewBlock({
    required this.label,
    required this.icon,
    required this.child,
  });

  final String label;
  final IconData icon;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return FptCard(
      outlined: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: AppColors.primary),
              const Gap(Insets.sm),
              Expanded(
                child: Text(
                  label,
                  style: Theme.of(
                    context,
                  ).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          const Gap(Insets.sm),
          child,
        ],
      ),
    );
  }
}
