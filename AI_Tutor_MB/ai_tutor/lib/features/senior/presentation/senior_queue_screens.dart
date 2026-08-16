import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
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
import '../../../core/theme/theme_extensions.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/models/senior_queue.dart';
import '../../../shared/widgets/knowledge_candidate_card.dart';
import '../../../shared/widgets/widgets.dart';
import '../../auth/application/auth_controller.dart';
import '../application/senior_controller.dart';

class SeniorReviewQueueScreen extends ConsumerWidget {
  const SeniorReviewQueueScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final queue = ref.watch(seniorQueueControllerProvider);

    return Scaffold(
      appBar: FptAppBar(title: l10n.seniorReviewQueueTitle),
      body: queue.when(
        loading: () => const LoadingSkeleton(),
        error: (error, _) => ErrorState(
          message: describeError(error),
          onRetry: () => ref.invalidate(seniorQueueControllerProvider),
        ),
        data: (data) {
          if (data.reviews.isEmpty) {
            return EmptyState(
              title: l10n.emptySeniorReviewsTitle,
              message: l10n.emptySeniorReviewsMessage,
              ctaLabel: l10n.refresh,
              onCta: () => ref.invalidate(seniorQueueControllerProvider),
            );
          }
          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () => ref.refresh(seniorQueueControllerProvider.future),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(
                Insets.screenH,
                Insets.screenTop,
                Insets.screenH,
                Insets.xxxl,
              ),
              itemCount: data.reviews.length,
              separatorBuilder: (_, __) => const Gap(Insets.md),
              itemBuilder: (context, index) {
                final review = data.reviews[index];
                return FptCard(
                      onTap: () => _openResolveSheet(context, ref, review),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  review.studentName ?? l10n.studentFallback,
                                  style: Theme.of(
                                    context,
                                  ).textTheme.titleMedium,
                                ),
                              ),
                              StatusPill(
                                domain: 'review',
                                value: review.status,
                              ),
                            ],
                          ),
                          if (review.courseName != null) ...[
                            const Gap(Insets.xs),
                            Text(
                              review.courseName!,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                          if (review.isGrouped &&
                              (review.reviewCount ?? 0) > 0) ...[
                            const Gap(Insets.xs),
                            Text(
                              '${review.reviewCount} phản hồi'
                              '${review.escalationTier != null ? ' · ${review.escalationTier}' : ''}',
                              style: Theme.of(context).textTheme.labelMedium
                                  ?.copyWith(color: AppColors.warning),
                            ),
                          ],
                          const Gap(Insets.md),
                          Text(
                            review.question ?? '—',
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                          const Gap(Insets.md),
                          Text(
                            l10n.resolveReview,
                            style: Theme.of(context).textTheme.labelLarge
                                ?.copyWith(color: AppColors.primary),
                          ),
                        ],
                      ),
                    )
                    .animate(delay: (40 * index).clamp(0, 320).ms)
                    .fadeIn(duration: Motion.base);
              },
            ),
          );
        },
      ),
    );
  }

  Future<void> _openResolveSheet(
    BuildContext context,
    WidgetRef ref,
    SeniorPendingReview review,
  ) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.fpt.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl)),
      ),
      builder: (context) => _ResolveReviewSheet(review: review),
    );
  }
}

class _ResolveReviewSheet extends HookConsumerWidget {
  const _ResolveReviewSheet({required this.review});

  final SeniorPendingReview review;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final notesController = useTextEditingController();
    final correctedController = useTextEditingController(
      text: review.aiAnswer ?? '',
    );
    final decision = useState('APPROVE_FEEDBACK');
    final createCandidate = useState(false);
    final submitting = useState(false);
    final errorText = useState<String?>(null);

    Future<void> submit() async {
      submitting.value = true;
      errorText.value = null;
      try {
        await ref
            .read(seniorQueueControllerProvider.notifier)
            .resolveReview(
              reviewId: review.id,
              decision: decision.value,
              notes: notesController.text.trim().isEmpty
                  ? null
                  : notesController.text.trim(),
              createKnowledgeCandidate: createCandidate.value,
              candidateType: createCandidate.value
                  ? 'ACADEMIC_KNOWLEDGE'
                  : null,
              correctedAnswer: correctedController.text.trim().isEmpty
                  ? null
                  : correctedController.text.trim(),
            );
        if (context.mounted) Navigator.pop(context);
      } catch (error) {
        errorText.value = describeError(error);
      } finally {
        submitting.value = false;
      }
    }

    return Padding(
      padding: EdgeInsets.fromLTRB(
        Insets.screenH,
        Insets.lg,
        Insets.screenH,
        MediaQuery.viewInsetsOf(context).bottom + Insets.xl,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              l10n.resolveReviewTitle,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const Gap(Insets.lg),
            Text(
              review.question ?? '—',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const Gap(Insets.lg),
            ...[
              ('APPROVE_FEEDBACK', l10n.decisionApproveFeedback),
              ('REJECT_FEEDBACK', l10n.decisionRejectFeedback),
              ('CREATE_KNOWLEDGE_CANDIDATE', l10n.decisionCreateCandidate),
            ].map(
              (entry) => RadioListTile<String>(
                contentPadding: EdgeInsets.zero,
                title: Text(entry.$2),
                value: entry.$1,
                groupValue: decision.value,
                activeColor: AppColors.primary,
                onChanged: (value) {
                  if (value != null) decision.value = value;
                },
              ),
            ),
            FptTextField(
              controller: notesController,
              label: l10n.reviewNotesLabel,
              maxLines: 3,
            ),
            if (decision.value == 'CREATE_KNOWLEDGE_CANDIDATE') ...[
              const Gap(Insets.md),
              FptTextField(
                controller: correctedController,
                label: l10n.correctedAnswerLabel,
                maxLines: 4,
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(l10n.createCandidateFromReview),
                subtitle: Text(l10n.proposeKnowledgeHint),
                value: createCandidate.value,
                activeThumbColor: AppColors.primary,
                onChanged: (v) => createCandidate.value = v,
              ),
            ],
            if (errorText.value != null) ...[
              const Gap(Insets.md),
              Text(
                errorText.value!,
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: AppColors.error),
              ),
            ],
            const Gap(Insets.lg),
            FptButton(
              label: l10n.submitResolution,
              loading: submitting.value,
              onPressed: submitting.value ? null : submit,
            ),
          ],
        ),
      ),
    );
  }
}

class KnowledgeCandidatesScreen extends ConsumerWidget {
  const KnowledgeCandidatesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final session = ref.watch(authControllerProvider).valueOrNull;
    final queue = ref.watch(seniorQueueControllerProvider);

    return Scaffold(
      appBar: FptAppBar(title: l10n.knowledgeCandidatesTitle),
      body: queue.when(
        loading: () => const LoadingSkeleton(),
        error: (error, _) => ErrorState(
          message: describeError(error),
          onRetry: () => ref.invalidate(seniorQueueControllerProvider),
        ),
        data: (data) {
          if (data.candidates.isEmpty) {
            return EmptyState(
              title: l10n.emptyCandidatesTitle,
              message: l10n.emptyCandidatesMessage,
              ctaLabel: l10n.refresh,
              onCta: () => ref.invalidate(seniorQueueControllerProvider),
            );
          }
          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () => ref.refresh(seniorQueueControllerProvider.future),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(
                Insets.screenH,
                Insets.screenTop,
                Insets.screenH,
                Insets.xxxl,
              ),
              itemCount: data.candidates.length,
              separatorBuilder: (_, __) => const Gap(Insets.md),
              itemBuilder: (context, index) {
                final candidate = data.candidates[index];
                final selfAuthored =
                    candidate.sourceMentorId == session?.userId;
                return KnowledgeCandidateCard(
                      candidate: candidate,
                      disabled: selfAuthored,
                      disabledReason: selfAuthored
                          ? l10n.cannotApproveOwnCandidate
                          : null,
                      onTap: () => context.push(
                        AppRoutes.knowledgeCandidateDetail(candidate.id),
                        extra: candidate,
                      ),
                    )
                    .animate(delay: (40 * index).clamp(0, 320).ms)
                    .fadeIn(duration: Motion.base);
              },
            ),
          );
        },
      ),
    );
  }
}

class KnowledgeCandidateDetailScreen extends HookConsumerWidget {
  const KnowledgeCandidateDetailScreen({
    super.key,
    required this.candidateId,
    this.candidate,
  });

  final String candidateId;
  final KnowledgeCandidateItem? candidate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;

    // Không có `extra` (vd. mở qua deep link) → tự tải lại theo id.
    if (candidate == null) {
      final fetched = ref.watch(candidateByIdProvider(candidateId));
      return fetched.when(
        loading: () => Scaffold(
          appBar: FptAppBar(title: l10n.candidateDetailTitle),
          body: const LoadingSkeleton(),
        ),
        error: (error, _) => Scaffold(
          appBar: FptAppBar(title: l10n.candidateDetailTitle),
          body: ErrorState(
            message: describeError(error),
            onRetry: () => ref.invalidate(candidateByIdProvider(candidateId)),
          ),
        ),
        data: (item) => _KnowledgeCandidateDetailBody(
          candidateId: candidateId,
          candidate: item,
        ),
      );
    }

    return _KnowledgeCandidateDetailBody(
      candidateId: candidateId,
      candidate: candidate!,
    );
  }
}

class _KnowledgeCandidateDetailBody extends HookConsumerWidget {
  const _KnowledgeCandidateDetailBody({
    required this.candidateId,
    required this.candidate,
  });

  final String candidateId;
  final KnowledgeCandidateItem candidate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final session = ref.watch(authControllerProvider).valueOrNull;
    final item = candidate;
    final noteController = useTextEditingController();
    final overrideController = useTextEditingController(
      text: item.correctedAnswer ?? item.proposedAnswer ?? '',
    );
    final rejectReasonController = useTextEditingController();
    final submitting = useState(false);
    final errorText = useState<String?>(null);

    final selfAuthored = item.sourceMentorId == session?.userId;

    Future<void> approve() async {
      submitting.value = true;
      errorText.value = null;
      try {
        await ref
            .read(seniorQueueControllerProvider.notifier)
            .approveCandidate(
              candidateId: candidateId,
              reviewNote: noteController.text.trim().isEmpty
                  ? null
                  : noteController.text.trim(),
              contentOverride: overrideController.text.trim().isEmpty
                  ? null
                  : overrideController.text.trim(),
            );
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(l10n.candidateApproved),
              backgroundColor: AppColors.success,
            ),
          );
          context.pop();
        }
      } catch (error) {
        errorText.value = describeError(error);
      } finally {
        submitting.value = false;
      }
    }

    Future<void> reject() async {
      final reason = rejectReasonController.text.trim();
      if (reason.isEmpty) {
        errorText.value = l10n.rejectionReasonRequired;
        return;
      }
      submitting.value = true;
      errorText.value = null;
      try {
        await ref
            .read(seniorQueueControllerProvider.notifier)
            .rejectCandidate(candidateId: candidateId, rejectionReason: reason);
        if (context.mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text(l10n.candidateRejected)));
          context.pop();
        }
      } catch (error) {
        errorText.value = describeError(error);
      } finally {
        submitting.value = false;
      }
    }

    return Scaffold(
      appBar: FptAppBar(title: l10n.candidateDetailTitle),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          Insets.screenH,
          Insets.screenTop,
          Insets.screenH,
          Insets.xxxl,
        ),
        children: [
          KnowledgeCandidateCard(candidate: item, disabled: selfAuthored),
          const Gap(Insets.xl),
          Text(
            l10n.aiLearningGateNotice,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: AppColors.info),
          ),
          const Gap(Insets.lg),
          Text(
            l10n.originalQuestion,
            style: Theme.of(context).textTheme.labelLarge,
          ),
          const Gap(Insets.sm),
          Text(item.question ?? '—'),
          const Gap(Insets.lg),
          Text(
            l10n.proposedAnswerLabel,
            style: Theme.of(context).textTheme.labelLarge,
          ),
          const Gap(Insets.sm),
          Text(item.proposedAnswer ?? '—'),
          if (item.correctedAnswer != null &&
              item.correctedAnswer != item.proposedAnswer) ...[
            const Gap(Insets.lg),
            Row(
              children: [
                Icon(
                  LucideIcons.arrowRight,
                  size: 16,
                  color: AppColors.primary,
                ),
                const Gap(Insets.sm),
                Text(
                  l10n.correctedAnswerLabel,
                  style: Theme.of(context).textTheme.labelLarge,
                ),
              ],
            ),
            const Gap(Insets.sm),
            Text(item.correctedAnswer!),
          ],
          const Gap(Insets.xl),
          FptTextField(
            controller: overrideController,
            label: l10n.contentOverrideLabel,
            maxLines: 4,
            errorText: selfAuthored ? l10n.cannotApproveOwnCandidate : null,
          ),
          const Gap(Insets.md),
          FptTextField(
            controller: noteController,
            label: l10n.reviewNotesLabel,
            maxLines: 2,
          ),
          const Gap(Insets.md),
          FptTextField(
            controller: rejectReasonController,
            label: l10n.rejectionReasonLabel,
            maxLines: 2,
          ),
          if (errorText.value != null) ...[
            const Gap(Insets.md),
            Text(
              errorText.value!,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: AppColors.error),
            ),
          ],
          const Gap(Insets.xl),
          FptButton(
            label: l10n.approveIndexRag,
            icon: LucideIcons.check,
            loading: submitting.value,
            onPressed: selfAuthored || submitting.value ? null : approve,
            expand: true,
          ),
          const Gap(Insets.md),
          FptButton(
            label: l10n.rejectCandidate,
            variant: FptButtonVariant.destructive,
            icon: LucideIcons.x,
            loading: submitting.value,
            onPressed: selfAuthored || submitting.value ? null : reject,
            expand: true,
          ),
        ],
      ),
    );
  }
}
