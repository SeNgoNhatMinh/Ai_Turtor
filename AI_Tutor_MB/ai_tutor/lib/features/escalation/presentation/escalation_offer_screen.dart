import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_motion.dart';
import '../../../core/theme/app_tokens.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/widgets/chat_bubble.dart';
import '../../../shared/widgets/mentor_card.dart';
import '../../../shared/widgets/widgets.dart';
import '../application/escalation_controller.dart';

class EscalationOfferScreen extends HookConsumerWidget {
  const EscalationOfferScreen({super.key, required this.escalationId});

  final String escalationId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final offer = ref.watch(escalationOfferControllerProvider(escalationId));
    final selecting = useState(false);

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: FptAppBar(title: l10n.escalationOfferTitle),
      body: offer.when(
        loading: () => const LoadingSkeleton(itemCount: 3),
        error: (error, _) => ErrorState(
          message: describeError(error),
          onRetry: () =>
              ref.invalidate(escalationOfferControllerProvider(escalationId)),
        ),
        data: (data) {
          final isClassTeacher = data.route == 'CLASS_TEACHER';

          return ListView(
            padding: const EdgeInsets.fromLTRB(
              Insets.screenH,
              Insets.screenTop,
              Insets.screenH,
              Insets.xxxl,
            ),
            children: [
              if (data.hasActiveChat) ...[
                FptCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'Cuộc trò chuyện đang mở',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const Gap(Insets.sm),
                      Text(
                        'Tiếp tục chat với mentor để không mất lịch sử tin nhắn.',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                      const Gap(Insets.md),
                      FptButton(
                        label: 'Tiếp tục trò chuyện',
                        expand: true,
                        onPressed: selecting.value
                            ? null
                            : () => context.push(
                                  AppRoutes.liveChat(data.activeChatRoomId!),
                                ),
                      ),
                    ],
                  ),
                ),
                const Gap(Insets.lg),
              ],
              Text(
                l10n.escalationOfferHeading,
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const Gap(Insets.sm),
              Text(
                isClassTeacher
                    ? l10n.escalationClassTeacherHint
                    : l10n.escalationMatchingHint,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              if (data.originalQuestion != null) ...[
                const Gap(Insets.xl),
                Text(
                  l10n.originalQuestion,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const Gap(Insets.sm),
                FptCard(
                  outlined: true,
                  child: Text(
                    data.originalQuestion!,
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                ),
              ],
              if (data.aiAnswer != null) ...[
                const Gap(Insets.lg),
                ChatBubble(isUser: false, content: data.aiAnswer!),
              ],
              const Gap(Insets.xl),
              Text(
                l10n.suggestedMentors,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const Gap(Insets.md),
              if (data.mentors.isEmpty)
                EmptyState(
                  title: l10n.noMentorsTitle,
                  message: l10n.noMentorsMessage,
                  ctaLabel: l10n.refresh,
                  onCta: () => ref.invalidate(
                    escalationOfferControllerProvider(escalationId),
                  ),
                )
              else
                ...data.mentors.asMap().entries.map((entry) {
                  final index = entry.key;
                  final mentor = entry.value;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: Insets.md),
                    child:
                        MentorCard(
                              mentor: mentor,
                              loading: selecting.value,
                              onSelect: () async {
                                selecting.value = true;
                                try {
                                  final roomId = await ref
                                      .read(
                                        escalationOfferControllerProvider(
                                          escalationId,
                                        ).notifier,
                                      )
                                      .selectMentor(mentor.id);
                                  if (!context.mounted) return;
                                  if (roomId.isEmpty) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text(
                                          'Không tạo được phòng chat. Vui lòng thử lại.',
                                        ),
                                      ),
                                    );
                                    return;
                                  }
                                  context.push(AppRoutes.liveChat(roomId));
                                } catch (error) {
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(describeError(error)),
                                      ),
                                    );
                                  }
                                } finally {
                                  selecting.value = false;
                                }
                              },
                            )
                            .animate(delay: (40 * index).clamp(0, 320).ms)
                            .fadeIn(duration: Motion.base)
                            .slideY(
                              begin: 0.08,
                              end: 0,
                              curve: Curves.easeOutCubic,
                            ),
                  );
                }),
              const Gap(Insets.lg),
              FptButton(
                label: l10n.cancelEscalation,
                variant: FptButtonVariant.ghost,
                expand: true,
                onPressed: selecting.value
                    ? null
                    : () async {
                        await ref
                            .read(
                              escalationOfferControllerProvider(
                                escalationId,
                              ).notifier,
                            )
                            .cancel();
                        if (context.mounted) context.pop();
                      },
              ),
            ],
          );
        },
      ),
    );
  }
}
