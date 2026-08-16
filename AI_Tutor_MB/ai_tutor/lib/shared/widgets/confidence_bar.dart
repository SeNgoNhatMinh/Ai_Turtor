import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_tokens.dart';

class ConfidenceBar extends StatelessWidget {
  const ConfidenceBar({super.key, required this.value});

  final double value;

  @override
  Widget build(BuildContext context) {
    final clamped = value.clamp(0.0, 1.0);
    final color = clamped >= 0.7
        ? AppColors.success
        : clamped >= 0.4
        ? AppColors.warning
        : AppColors.error;
    final label = clamped >= 0.7
        ? 'Tin cậy'
        : clamped >= 0.4
        ? 'AI chưa chắc'
        : 'Độ tin thấp';

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 48,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(Radii.full),
            child: LinearProgressIndicator(
              value: clamped,
              minHeight: 4,
              backgroundColor: AppColors.warm300,
              color: color,
            ),
          ),
        ),
        const SizedBox(width: Insets.sm),
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: color),
        ),
      ],
    );
  }
}
