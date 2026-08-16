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
import '../../../shared/models/live_chat.dart';
import '../../../shared/widgets/chat_bubble.dart';
import '../../../shared/widgets/widgets.dart';
import '../../ai_tutor/presentation/widgets/ai_chat_widgets.dart';
import '../../auth/application/auth_controller.dart';
import '../application/escalation_controller.dart';

class LiveChatScreen extends HookConsumerWidget {
  const LiveChatScreen({super.key, required this.chatRoomId});

  final String chatRoomId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final messageController = useTextEditingController();
    final contextExpanded = useState(false);
    final sending = useState(false);
    final scrollController = useScrollController();
    final chat = ref.watch(liveChatControllerProvider(chatRoomId));
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
        ref
            .read(liveChatControllerProvider(chatRoomId).notifier)
            .reload();
      }

      final observer = _LiveChatLifecycleObserver(onResume: onResume);
      WidgetsBinding.instance.addObserver(observer);
      return () => WidgetsBinding.instance.removeObserver(observer);
    }, [chatRoomId]);

    Future<void> handleSend() async {
      final text = messageController.text.trim();
      if (text.isEmpty || sending.value) return;
      messageController.clear();
      sending.value = true;
      try {
        await ref
            .read(liveChatControllerProvider(chatRoomId).notifier)
            .sendMessage(text);
      } catch (error) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(describeError(error))),
          );
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
          onlineLabel: l10n.liveChatOnline,
          onBack: leaveLiveChat,
          onClose: data.detail.isReadOnly
              ? null
              : () => _showCloseSheet(
                    context,
                    ref,
                    chatRoomId,
                    role: session?.role,
                  ),
        ),
        orElse: () => _LiveChatAppBar(
          mentorName: l10n.liveChatTitle,
          onlineLabel: l10n.liveChatOnline,
          onBack: leaveLiveChat,
        ),
      ),
      body: chat.when(
        loading: () => const LoadingSkeleton(itemCount: 4),
        error: (error, _) => ErrorState(
          message: describeError(error),
          onRetry: () => ref.invalidate(liveChatControllerProvider(chatRoomId)),
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
                  onToggle: () => contextExpanded.value = !contextExpanded.value,
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
                                      ?.copyWith(color: AppColors.textTertiary),
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
    String chatRoomId, {
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
                          .read(liveChatControllerProvider(chatRoomId).notifier)
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

class _LiveChatAppBar extends StatelessWidget implements PreferredSizeWidget {
  const _LiveChatAppBar({
    required this.mentorName,
    required this.onlineLabel,
    required this.onBack,
    this.mentorAvatarUrl,
    this.onClose,
  });

  final String mentorName;
  final String onlineLabel;
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
            backgroundImage:
                mentorAvatarUrl != null ? NetworkImage(mentorAvatarUrl!) : null,
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
                      decoration: const BoxDecoration(
                        color: AppColors.leafGreen,
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
            border: Border(
              bottom: BorderSide(color: AppColors.borderHairline),
            ),
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
          backgroundImage:
              mentorAvatarUrl != null ? NetworkImage(mentorAvatarUrl!) : null,
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

class EscalationHistoryScreen extends ConsumerWidget {
  const EscalationHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final history = ref.watch(escalationHistoryControllerProvider);

    return Scaffold(
      backgroundColor: AppColors.canvas,
      appBar: FptAppBar(title: l10n.escalationHistoryTitle),
      body: history.when(
        loading: () => const LoadingSkeleton(),
        error: (error, _) => ErrorState(
          message: describeError(error),
          onRetry: () => ref.invalidate(escalationHistoryControllerProvider),
        ),
        data: (items) => items.isEmpty
            ? EmptyState(
                title: l10n.emptyEscalationHistoryTitle,
                message: l10n.emptyEscalationHistoryMessage,
              )
            : RefreshIndicator(
                color: AppColors.primary,
                onRefresh: () =>
                    ref.refresh(escalationHistoryControllerProvider.future),
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
                      onTap: item.chatRoomId != null
                          ? () => context.push(
                              AppRoutes.liveChat(item.chatRoomId!),
                            )
                          : null,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  item.originalQuestion ?? '—',
                                  style: Theme.of(
                                    context,
                                  ).textTheme.titleMedium,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              StatusPill(
                                domain: 'escalation',
                                value: item.status,
                              ),
                            ],
                          ),
                          if (item.status.toUpperCase() == 'IN_CHAT' &&
                              item.chatRoomId != null) ...[
                            const Gap(Insets.md),
                            FptButton(
                              label: 'Tiếp tục trò chuyện',
                              size: FptButtonSize.sm,
                              onPressed: () => context.push(
                                AppRoutes.liveChat(item.chatRoomId!),
                              ),
                            ),
                          ],
                          if (item.mentorName != null) ...[
                            const Gap(Insets.sm),
                            Text(
                              item.mentorName!,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                          if (item.createdAt != null) ...[
                            const Gap(Insets.xs),
                            Text(
                              formatRelativeTime(item.createdAt!),
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ],
                      ),
                    );
                  },
                ),
              ),
      ),
    );
  }
}
