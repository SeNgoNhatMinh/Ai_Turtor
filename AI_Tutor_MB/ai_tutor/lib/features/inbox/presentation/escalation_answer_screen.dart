import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:gap/gap.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../core/network/exceptions.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/models/teacher_inbox.dart';
import '../../../shared/widgets/widgets.dart';
import '../application/teacher_inbox_controller.dart';

const _candidateTypes = [
  'ACADEMIC_KNOWLEDGE',
  'MATERIAL_CORRECTION',
  'FAQ_CLARIFICATION',
];

class EscalationAnswerScreen extends HookConsumerWidget {
  const EscalationAnswerScreen({
    super.key,
    required this.escalationId,
    this.item,
  });

  final String escalationId;
  final TeacherEscalationItem? item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final answerController = useTextEditingController();
    final proposeKnowledge = useState(false);
    final candidateType = useState(_candidateTypes.first);
    final submitting = useState(false);
    final errorText = useState<String?>(null);

    final inbox = ref.watch(teacherInboxControllerProvider);
    final escalation =
        item ??
        inbox.maybeWhen(
          data: (data) {
            for (final candidate in [...data.escalations, ...data.liveChats]) {
              if (candidate.id == escalationId) return candidate;
            }
            return null;
          },
          orElse: () => null,
        );

    if (inbox.isLoading && escalation == null) {
      return Scaffold(
        backgroundColor: Colors.transparent,
        appBar: FptAppBar(title: l10n.answerEscalationTitle),
        body: const LoadingSkeleton(itemCount: 2),
      );
    }

    if (escalation == null) {
      return Scaffold(
        backgroundColor: Colors.transparent,
        appBar: FptAppBar(title: l10n.answerEscalationTitle),
        body: ErrorState(
          message: l10n.escalationNotFound,
          onRetry: () => context.pop(),
        ),
      );
    }

    Future<void> submit() async {
      final answer = answerController.text.trim();
      if (answer.isEmpty) {
        errorText.value = l10n.answerRequired;
        return;
      }
      submitting.value = true;
      errorText.value = null;
      try {
        await ref
            .read(teacherInboxControllerProvider.notifier)
            .answerEscalation(
              escalationId: escalationId,
              answer: answer,
              createKnowledgeCandidate: proposeKnowledge.value,
              candidateType: proposeKnowledge.value
                  ? candidateType.value
                  : null,
            );
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(l10n.answerSubmitted),
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

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: FptAppBar(title: l10n.answerEscalationTitle),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          Insets.screenH,
          Insets.screenTop,
          Insets.screenH,
          Insets.xxxl,
        ),
        children: [
          if (escalation.studentName != null)
            Text(
              escalation.studentName!,
              style: Theme.of(context).textTheme.titleMedium,
            ),
          if (escalation.courseName != null) ...[
            const Gap(Insets.xs),
            Text(
              escalation.courseName!,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          const Gap(Insets.xl),
          Text(
            l10n.originalQuestion,
            style: Theme.of(context).textTheme.labelLarge,
          ),
          const Gap(Insets.sm),
          FptCard(
            outlined: true,
            child: Text(
              escalation.originalQuestion ?? '—',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
          ),
          if (escalation.aiAnswer != null) ...[
            const Gap(Insets.lg),
            Text(
              l10n.aiResponseLabel,
              style: Theme.of(context).textTheme.labelLarge,
            ),
            const Gap(Insets.sm),
            FptCard(
              outlined: true,
              child: Text(
                escalation.aiAnswer!,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
          ],
          const Gap(Insets.xl),
          FptTextField(
            controller: answerController,
            label: l10n.yourAnswerLabel,
            hint: l10n.yourAnswerHint,
            maxLines: 6,
            errorText: errorText.value,
          ),
          const Gap(Insets.lg),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(
              l10n.proposeKnowledgeToggle,
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            subtitle: Text(
              l10n.proposeKnowledgeHint,
              style: Theme.of(context).textTheme.bodySmall,
            ),
            value: proposeKnowledge.value,
            activeThumbColor: AppColors.primary,
            onChanged: (value) => proposeKnowledge.value = value,
          ),
          if (proposeKnowledge.value) ...[
            const Gap(Insets.md),
            Text(
              l10n.candidateTypeLabel,
              style: Theme.of(context).textTheme.labelLarge,
            ),
            const Gap(Insets.sm),
            ..._candidateTypes.map(
              (type) => RadioListTile<String>(
                contentPadding: EdgeInsets.zero,
                title: Text(
                  _candidateTypeLabel(l10n, type),
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                value: type,
                groupValue: candidateType.value,
                activeColor: AppColors.primary,
                onChanged: (value) {
                  if (value != null) candidateType.value = value;
                },
              ),
            ),
          ],
          const Gap(Insets.xl),
          FptButton(
            label: l10n.submitAnswer,
            loading: submitting.value,
            onPressed: submitting.value ? null : submit,
            expand: true,
          ),
        ],
      ),
    );
  }

  String _candidateTypeLabel(AppLocalizations l10n, String type) {
    return switch (type) {
      'ACADEMIC_KNOWLEDGE' => l10n.candidateAcademic,
      'MATERIAL_CORRECTION' => l10n.candidateMaterial,
      'FAQ_CLARIFICATION' => l10n.candidateFaq,
      _ => type,
    };
  }
}
