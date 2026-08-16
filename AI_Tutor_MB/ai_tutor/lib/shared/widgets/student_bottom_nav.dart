import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/constants/app_assets.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';

class StudentBottomNav extends StatelessWidget {
  const StudentBottomNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
    required this.items,
  });

  final int currentIndex;
  final ValueChanged<int> onTap;
  final List<StudentBottomNavItem> items;

  static const _barHeight = 58.0;
  static const _fabSize = 56.0;
  static const _fabLift = 18.0;

  @override
  Widget build(BuildContext context) {
    final centerIndex = items.indexWhere((i) => i.isCenter);

    return DecoratedBox(
      decoration: const BoxDecoration(
        color: AppColors.navBarBg,
        boxShadow: [
          BoxShadow(
            color: Color(0x12000000),
            blurRadius: 12,
            offset: Offset(0, -3),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: _barHeight + _fabLift,
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.bottomCenter,
            children: [
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                height: _barHeight,
                child: Row(
                  children: [
                    for (var i = 0; i < items.length; i++)
                      Expanded(
                        child: items[i].isCenter
                            ? const SizedBox.shrink()
                            : _SideNavItem(
                                item: items[i],
                                selected: i == currentIndex,
                                onTap: () => _handleTap(i),
                              ),
                      ),
                  ],
                ),
              ),
              if (centerIndex >= 0)
                Positioned(
                  top: 0,
                  child: _CenterNavItem(
                    item: items[centerIndex],
                    selected: centerIndex == currentIndex,
                    onTap: () => _handleTap(centerIndex),
                    size: _fabSize,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  void _handleTap(int index) {
    if (index != currentIndex) {
      HapticFeedback.selectionClick();
      onTap(index);
    }
  }
}

class StudentBottomNavItem {
  const StudentBottomNavItem({
    required this.label,
    required this.icon,
    this.isCenter = false,
  });

  final String label;
  final IconData icon;
  final bool isCenter;
}

class _SideNavItem extends StatelessWidget {
  const _SideNavItem({
    required this.item,
    required this.selected,
    required this.onTap,
  });

  final StudentBottomNavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? AppColors.navActive : AppColors.navInactive;

    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      child: InkWell(
        onTap: onTap,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(item.icon, size: 22, color: color),
            const SizedBox(height: 3),
            Text(
              item.label,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: color,
                fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                height: 1.0,
                fontSize: 10,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CenterNavItem extends StatelessWidget {
  const _CenterNavItem({
    required this.item,
    required this.selected,
    required this.onTap,
    required this.size,
  });

  final StudentBottomNavItem item;
  final bool selected;
  final VoidCallback onTap;
  final double size;

  @override
  Widget build(BuildContext context) {
    final labelColor = selected ? AppColors.accent : AppColors.navInactive;

    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(size),
        child: SizedBox(
          width: size + 8,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: size,
                height: size,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.accent,
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.accent.withValues(alpha: 0.4),
                      blurRadius: 16,
                      spreadRadius: 1,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Center(
                  child: Image.asset(
                    AppAssets.cocVangLogoTransparent,
                    width: size - 10,
                    height: size - 10,
                    fit: BoxFit.contain,
                    filterQuality: FilterQuality.high,
                    gaplessPlayback: true,
                    errorBuilder: (_, __, ___) => const Icon(
                      LucideIcons.sparkles,
                      color: AppColors.onOrange,
                      size: 24,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                item.label,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: labelColor,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                  fontSize: 10,
                  height: 1.0,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
