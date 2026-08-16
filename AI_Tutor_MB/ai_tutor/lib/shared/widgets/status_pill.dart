import 'package:flutter/material.dart';
import 'package:gap/gap.dart';

import '../../core/theme/app_tokens.dart';
import '../../core/utils/status_style.dart';

class StatusPill extends StatelessWidget {
  const StatusPill({super.key, required this.domain, required this.value});

  final String domain;
  final String value;

  @override
  Widget build(BuildContext context) {
    final (fg, bg, label) = statusStyleFor(domain, value);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: Insets.xs),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(Radii.full),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: fg, shape: BoxShape.circle),
          ),
          const Gap(Insets.sm),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: fg,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
