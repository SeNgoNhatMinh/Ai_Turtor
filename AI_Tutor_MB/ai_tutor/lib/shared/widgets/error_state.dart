import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_tokens.dart';
import '../../l10n/app_localizations.dart';
import 'fpt_button.dart';

class ErrorState extends StatelessWidget {
  const ErrorState({
    super.key,
    required this.message,
    this.onRetry,
    this.secondaryActionLabel,
    this.onSecondaryAction,
  });

  final String message;
  final VoidCallback? onRetry;
  final String? secondaryActionLabel;
  final VoidCallback? onSecondaryAction;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final textTheme = Theme.of(context).textTheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(Insets.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              LucideIcons.alertCircle,
              size: 40,
              color: AppColors.error,
            ),
            const Gap(Insets.md),
            Text(
              message,
              style: textTheme.bodyMedium,
              textAlign: TextAlign.center,
            ),
            if (onRetry != null) ...[
              const Gap(Insets.lg),
              FptButton(
                label: l10n.retry,
                onPressed: onRetry,
                variant: FptButtonVariant.secondary,
                size: FptButtonSize.md,
              ),
            ],
            if (onSecondaryAction != null &&
                secondaryActionLabel != null &&
                secondaryActionLabel!.isNotEmpty) ...[
              const Gap(Insets.sm),
              FptButton(
                label: secondaryActionLabel!,
                onPressed: onSecondaryAction,
                size: FptButtonSize.md,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
