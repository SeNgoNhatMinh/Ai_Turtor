import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_tokens.dart';
import '../../core/theme/theme_extensions.dart';

class SettingsTile extends StatelessWidget {
  const SettingsTile({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.onTap,
    this.trailing,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final fpt = context.fpt;
    return Semantics(
      button: onTap != null,
      label: title,
      child: Material(
        color: fpt.card,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: Insets.lg,
              vertical: Insets.md,
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(Insets.sm),
                  decoration: BoxDecoration(
                    color: fpt.primaryWash,
                    borderRadius: BorderRadius.circular(Radii.md),
              border: Border.all(color: AppColors.homeOrangeWash),
                  ),
                  child: Icon(icon, size: 18, color: AppColors.primaryDark),
                ),
                const Gap(Insets.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(
                          context,
                        ).textTheme.bodyLarge?.copyWith(color: fpt.textPrimary),
                      ),
                      if (subtitle != null) ...[
                        const Gap(Insets.xs),
                        Text(
                          subtitle!,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(color: fpt.textTertiary),
                        ),
                      ],
                    ],
                  ),
                ),
                trailing ??
                    Icon(
                      LucideIcons.chevronRight,
                      size: 18,
                      color: fpt.textTertiary,
                    ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
