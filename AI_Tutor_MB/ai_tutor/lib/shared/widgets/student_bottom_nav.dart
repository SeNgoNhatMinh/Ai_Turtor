import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/constants/app_assets.dart';
import '../../../core/theme/app_colors.dart';

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
  static const _fabSize = 64.0;
  static const _fabLift = 34.0;

  @override
  Widget build(BuildContext context) {
    final centerIndex = items.indexWhere((i) => i.isCenter);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
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
                child: DecoratedBox(
                  decoration: const BoxDecoration(
                    color: AppColors.navBarBg,
                    border: Border(
                      top: BorderSide(
                        color: AppColors.borderHairline,
                        width: 1,
                      ),
                    ),
                  ),
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
        ColoredBox(
          color: AppColors.navBarBg,
          child: SizedBox(height: MediaQuery.paddingOf(context).bottom),
        ),
      ],
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
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: SizedBox(
          width: size + 12,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Material(
                color: AppColors.fptOrange,
                elevation: 8,
                shadowColor: AppColors.fptOrange.withValues(alpha: 0.55),
                shape: const CircleBorder(),
                clipBehavior: Clip.antiAlias,
                child: SizedBox(
                  width: size,
                  height: size,
                  child: Image.asset(
                    AppAssets.askCocButton,
                    fit: BoxFit.cover,
                    alignment: Alignment.center,
                    filterQuality: FilterQuality.high,
                    gaplessPlayback: true,
                    errorBuilder: (_, __, ___) => Image.asset(
                      AppAssets.cocFptEducation,
                      fit: BoxFit.cover,
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
