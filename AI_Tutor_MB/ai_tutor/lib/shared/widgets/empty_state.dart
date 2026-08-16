import 'package:flutter/material.dart';
import 'package:gap/gap.dart';

import '../../core/theme/app_tokens.dart';
import 'fpt_button.dart';

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.title,
    this.message,
    this.asset,
    this.ctaLabel,
    this.onCta,
  });

  final String title;
  final String? message;
  final String? asset;
  final String? ctaLabel;
  final VoidCallback? onCta;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(Insets.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (asset != null) ...[
              // SVG illustrations added in later phases.
              const Gap(Insets.xl),
            ],
            Text(
              title,
              style: textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            if (message != null) ...[
              const Gap(Insets.sm),
              Text(
                message!,
                style: textTheme.bodyMedium,
                textAlign: TextAlign.center,
              ),
            ],
            if (ctaLabel != null) ...[
              const Gap(Insets.xl),
              FptButton(
                label: ctaLabel!,
                onPressed: onCta,
                size: FptButtonSize.md,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
