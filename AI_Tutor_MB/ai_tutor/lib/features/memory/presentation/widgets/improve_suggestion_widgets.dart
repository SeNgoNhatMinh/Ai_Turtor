import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/constants/app_flags.dart';
import '../../../../core/network/exceptions.dart';
import '../../../../core/router/routes.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/utils/ai_study_tips.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../shared/models/improve_suggestion.dart';
import '../../../../shared/widgets/widgets.dart';
import '../../../quiz/presentation/student_quiz_screens.dart';
import '../../application/improve_plan_controller.dart';

/// Card "Tiếp tục học" — giống FE web [AnswerImproveSuggestions].
/// Chỉ hiện khi markdown không có section "Lưu ý để học tốt hơn".
class ImproveSuggestionsStrip extends StatelessWidget {
  const ImproveSuggestionsStrip({
    super.key,
    required this.suggestions,
    required this.answerMarkdown,
    required this.consumedKeys,
    required this.onLearn,
    this.onCreateQuiz,
    this.loadingKey,
  });

  final List<ImproveSuggestionItem> suggestions;
  final String answerMarkdown;
  final Set<String> consumedKeys;
  final ValueChanged<ImproveSuggestionItem> onLearn;
  final ValueChanged<ImproveSuggestionItem>? onCreateQuiz;
  final String? loadingKey;

  static List<ImproveSuggestionItem> _dedupe(List<ImproveSuggestionItem> items) {
    final seen = <String>{};
    final result = <ImproveSuggestionItem>[];
    for (final item in items) {
      final key = item.title.trim().toLowerCase();
      if (key.isEmpty || seen.contains(key)) continue;
      seen.add(key);
      result.add(item);
      if (result.length >= 4) break;
    }
    return result;
  }

  @override
  Widget build(BuildContext context) {
    if (!AppFlags.showImproveSuggestions || suggestions.isEmpty) {
      return const SizedBox.shrink();
    }
    if (hasStudyTipsSection(answerMarkdown)) {
      return const SizedBox.shrink();
    }

    final l10n = AppLocalizations.of(context)!;
    final unique = _dedupe(suggestions);
    if (unique.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: Insets.md),
      child: Container(
        padding: const EdgeInsets.all(Insets.md),
        decoration: BoxDecoration(
          color: const Color(0xFFFAFAFA),
          borderRadius: BorderRadius.circular(Radii.md),
          border: Border.all(color: AppColors.borderHairline),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Tiếp tục học',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const Gap(2),
            Text(
              'Chọn nội dung bạn muốn học tiếp từ câu trả lời này.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
            ),
            const Gap(Insets.sm),
            ...unique.map((item) {
              final consumed = consumedKeys.contains(item.key);
              final loading = loadingKey == item.key;
              return Padding(
                padding: const EdgeInsets.only(bottom: Insets.xs),
                child: _ContinueLearningRow(
                  label: item.title,
                  consumed: consumed,
                  loading: loading,
                  learnLabel: l10n.learnNow,
                  onLearn: consumed ? null : () => onLearn(item),
                  onCreateQuiz: onCreateQuiz == null || consumed
                      ? null
                      : () => onCreateQuiz!(item),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}

class _ContinueLearningRow extends StatelessWidget {
  const _ContinueLearningRow({
    required this.label,
    required this.consumed,
    required this.loading,
    required this.learnLabel,
    this.onLearn,
    this.onCreateQuiz,
  });

  final String label;
  final bool consumed;
  final bool loading;
  final String learnLabel;
  final VoidCallback? onLearn;
  final VoidCallback? onCreateQuiz;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: Insets.sm,
        vertical: Insets.xs,
      ),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(Radii.sm),
        border: Border.all(color: AppColors.borderHairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            consumed ? '$label · Đã học' : label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: consumed
                      ? AppColors.textTertiary
                      : AppColors.textPrimary,
                ),
          ),
          const Gap(Insets.xs),
          Wrap(
            alignment: WrapAlignment.end,
            spacing: Insets.xs,
            runSpacing: Insets.xs,
            children: [
              if (onCreateQuiz != null)
                _CompactActionButton(
                  label: 'Tạo quiz',
                  icon: LucideIcons.clipboardList,
                  onPressed: onCreateQuiz,
                ),
              _CompactActionButton(
                label: learnLabel,
                icon: LucideIcons.bookOpenCheck,
                loading: loading,
                onPressed: loading ? null : onLearn,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CompactActionButton extends StatelessWidget {
  const _CompactActionButton({
    required this.label,
    required this.icon,
    this.onPressed,
    this.loading = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onPressed;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return TextButton.icon(
      onPressed: loading ? null : onPressed,
      style: TextButton.styleFrom(
        minimumSize: const Size(0, 30),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        visualDensity: VisualDensity.compact,
        foregroundColor: AppColors.textSecondary,
      ),
      icon: loading
          ? const SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Icon(icon, size: 14),
      label: Text(label, style: Theme.of(context).textTheme.labelSmall),
    );
  }
}

/// Hàng gợi ý dùng chung: Improve Plan, Course checklist.
class ImproveSuggestionActionRow extends HookConsumerWidget {
  const ImproveSuggestionActionRow({
    super.key,
    required this.label,
    required this.pinned,
    this.consumed = false,
    this.loadingLearn = false,
    this.loadingPin = false,
    required this.learnLabel,
    required this.quizLabel,
    required this.pinTooltip,
    this.onLearn,
    this.onCreateQuiz,
    this.onTogglePin,
  });

  final String label;
  final bool pinned;
  final bool consumed;
  final bool loadingLearn;
  final bool loadingPin;
  final String learnLabel;
  final String quizLabel;
  final String pinTooltip;
  final VoidCallback? onLearn;
  final VoidCallback? onCreateQuiz;
  final VoidCallback? onTogglePin;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Opacity(
      opacity: consumed ? 0.55 : 1,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: Insets.md,
          vertical: Insets.xs,
        ),
        decoration: BoxDecoration(
          color: pinned ? AppColors.primaryWash : AppColors.card,
          borderRadius: BorderRadius.circular(Radii.md),
          border: pinned ? null : Border.all(color: AppColors.borderHairline),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              consumed ? '$label · Đã học' : label,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w600,
                  ),
            ),
            const Gap(Insets.xs),
            Wrap(
              alignment: WrapAlignment.end,
              spacing: Insets.xs,
              runSpacing: Insets.xs,
              children: [
                if (onTogglePin != null)
                  IconButton(
                    tooltip: pinTooltip,
                    visualDensity: VisualDensity.compact,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(
                      minWidth: 32,
                      minHeight: 32,
                    ),
                    icon: loadingPin
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Icon(
                            pinned
                                ? LucideIcons.bookmarkMinus
                                : LucideIcons.bookmarkPlus,
                            size: 18,
                            color: pinned
                                ? AppColors.primary
                                : AppColors.textTertiary,
                          ),
                    onPressed: loadingPin ? null : onTogglePin,
                  ),
                if (onCreateQuiz != null)
                  FptButton(
                    label: quizLabel,
                    variant: FptButtonVariant.ghost,
                    size: FptButtonSize.sm,
                    icon: LucideIcons.clipboardList,
                    onPressed: consumed ? null : onCreateQuiz,
                  ),
                FptButton(
                  label: learnLabel,
                  variant: FptButtonVariant.secondary,
                  size: FptButtonSize.sm,
                  icon: LucideIcons.sparkles,
                  loading: loadingLearn,
                  onPressed: consumed || loadingLearn ? null : onLearn,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class PinnedImproveSuggestionsSection extends HookConsumerWidget {
  const PinnedImproveSuggestionsSection({
    super.key,
    required this.courseRouteId,
    required this.pinnedLabels,
    this.compact = false,
  });

  final String courseRouteId;
  final List<String> pinnedLabels;
  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (pinnedLabels.isEmpty) return const SizedBox.shrink();
    final l10n = AppLocalizations.of(context)!;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Đã ghim để ôn',
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
                color: AppColors.textTertiary,
                letterSpacing: 0.8,
                fontWeight: FontWeight.w700,
              ),
        ),
        const Gap(Insets.sm),
        ...pinnedLabels.map(
          (label) => Padding(
            padding: const EdgeInsets.only(bottom: Insets.sm),
            child: _PinnedSuggestionTile(
              courseRouteId: courseRouteId,
              label: label,
              compact: compact,
              learnLabel: l10n.learnNow,
              quizLabel: 'Tạo quiz',
              unpinTooltip: l10n.unpinSuggestion,
            ),
          ),
        ),
      ],
    );
  }
}

class _PinnedSuggestionTile extends HookConsumerWidget {
  const _PinnedSuggestionTile({
    required this.courseRouteId,
    required this.label,
    required this.compact,
    required this.learnLabel,
    required this.quizLabel,
    required this.unpinTooltip,
  });

  final String courseRouteId;
  final String label;
  final bool compact;
  final String learnLabel;
  final String quizLabel;
  final String unpinTooltip;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final learning = useState(false);
    final unpinning = useState(false);

    Future<void> onUnpin() async {
      unpinning.value = true;
      try {
        await ref
            .read(improvePlanControllerProvider(courseRouteId).notifier)
            .togglePin(courseRouteId, label, pinned: true);
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(describeError(e))),
          );
        }
      } finally {
        unpinning.value = false;
      }
    }

    Future<void> onLearn() async {
      learning.value = true;
      try {
        final conversationId = await ref
            .read(improvePlanControllerProvider(courseRouteId).notifier)
            .learnFromSuggestion(courseRouteId, label);
        if (context.mounted && conversationId != null) {
          context.push(AppRoutes.studentTutorChat(conversationId));
        }
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(describeError(e))),
          );
        }
      } finally {
        learning.value = false;
      }
    }

    return ImproveSuggestionActionRow(
      label: label,
      pinned: true,
      loadingLearn: learning.value,
      loadingPin: unpinning.value,
      learnLabel: learnLabel,
      quizLabel: quizLabel,
      pinTooltip: unpinTooltip,
      onLearn: onLearn,
      onCreateQuiz: () => onCreateQuizFromSuggestion(
        context,
        courseRouteId: courseRouteId,
        label: label,
      ),
      onTogglePin: onUnpin,
    );
  }
}

Future<void> onCreateQuizFromSuggestion(
  BuildContext context, {
  required String courseRouteId,
  required String label,
}) async {
  await Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (_) => TakeQuizScreen(
        courseId: courseRouteId,
        topic: label,
        suggestionText: label,
      ),
    ),
  );
}
