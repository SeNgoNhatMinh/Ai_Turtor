import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/constants/app_assets.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';

/// Nền gradient cam nhạt — bọc body màn hình PlugPro.
class PlugProBackground extends StatelessWidget {
  const PlugProBackground({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(gradient: AppColors.homeScreenGradient),
      child: child,
    );
  }
}

/// Scaffold chuẩn PlugPro: nền gradient + header tuỳ chọn + body.
class PlugProPageScaffold extends StatelessWidget {
  const PlugProPageScaffold({
    super.key,
    this.header,
    required this.body,
    this.floatingActionButton,
  });

  final Widget? header;
  final Widget body;
  final Widget? floatingActionButton;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.homeBgBottom,
      floatingActionButton: floatingActionButton,
      body: PlugProBackground(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (header != null) header!,
            Expanded(child: body),
          ],
        ),
      ),
    );
  }
}

/// Header tab: logo Cóc + tiêu đề + actions.
class PlugProAppBar extends StatelessWidget {
  const PlugProAppBar({
    super.key,
    this.title = 'Ask Cóc',
    this.showLogo = true,
    this.actions = const [],
  });

  final String title;
  final bool showLogo;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        Insets.screenH,
        Insets.md,
        Insets.screenH,
        Insets.sm,
      ),
      child: Row(
        children: [
          if (showLogo) ...[
            Image.asset(
              AppAssets.cocVangLogoTransparent,
              width: 36,
              height: 36,
              fit: BoxFit.contain,
              filterQuality: FilterQuality.high,
              errorBuilder: (_, __, ___) => Image.asset(
                AppAssets.cocVangLogo,
                width: 36,
                height: 36,
                fit: BoxFit.contain,
              ),
            ),
            const Gap(Insets.sm),
          ],
          Expanded(
            child: Text(
              title,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
                letterSpacing: -0.3,
              ),
            ),
          ),
          ...actions,
        ],
      ),
    );
  }
}

/// Nút icon viền cam (thông báo, lọc, …).
class PlugProIconButton extends StatelessWidget {
  const PlugProIconButton({
    super.key,
    required this.icon,
    this.onTap,
    this.badge = false,
  });

  final IconData icon;
  final VoidCallback? onTap;
  final bool badge;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.card,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(Radii.md),
        side: const BorderSide(color: AppColors.borderHairline, width: 1.5),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(Radii.md),
        child: SizedBox(
          width: 44,
          height: 44,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Icon(icon, size: 20, color: AppColors.primary),
              if (badge)
                Positioned(
                  right: 10,
                  top: 10,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: AppColors.error,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Thanh tìm kiếm pill + nút lọc.
class PlugProSearchBar extends StatelessWidget {
  const PlugProSearchBar({
    super.key,
    required this.hint,
    required this.controller,
    this.onFilterTap,
  });

  final String hint;
  final TextEditingController controller;
  final VoidCallback? onFilterTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: Insets.screenH),
      child: Row(
        children: [
          Expanded(
            child: Container(
              height: 52,
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(26),
                border: Border.all(color: AppColors.homeOrangeWash),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x0F211C18),
                    blurRadius: 16,
                    offset: Offset(0, 4),
                  ),
                ],
              ),
              child: TextField(
                controller: controller,
                decoration: InputDecoration(
                  hintText: hint,
                  hintStyle: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.textTertiary,
                  ),
                  prefixIcon: const Icon(
                    LucideIcons.search,
                    size: 20,
                    color: AppColors.primary,
                  ),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: Insets.md,
                    vertical: Insets.md,
                  ),
                ),
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
          ),
          if (onFilterTap != null) ...[
            const Gap(Insets.sm),
            PlugProIconButton(
              icon: LucideIcons.slidersHorizontal,
              onTap: onFilterTap,
            ),
          ],
        ],
      ),
    );
  }
}

class PlugProPill {
  const PlugProPill({
    required this.id,
    required this.label,
    required this.icon,
  });

  final String id;
  final String label;
  final IconData icon;
}

/// Pills cuộn ngang — filter / category.
class PlugProPills extends StatelessWidget {
  const PlugProPills({
    super.key,
    required this.pills,
    required this.selectedId,
    required this.onSelected,
  });

  final List<PlugProPill> pills;
  final String selectedId;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: Insets.screenH),
        itemCount: pills.length,
        separatorBuilder: (_, __) => const Gap(Insets.sm),
        itemBuilder: (context, index) {
          final pill = pills[index];
          final selected = pill.id == selectedId;
          return Material(
            color: selected ? AppColors.primary : AppColors.card,
            borderRadius: BorderRadius.circular(22),
            child: InkWell(
              onTap: () => onSelected(pill.id),
              borderRadius: BorderRadius.circular(22),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: Insets.lg,
                  vertical: Insets.sm,
                ),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(22),
                  border: selected
                      ? null
                      : Border.all(
                          color: AppColors.homeOrangeWash,
                          width: 1.5,
                        ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      pill.icon,
                      size: 16,
                      color: selected ? AppColors.onOrange : AppColors.primary,
                    ),
                    const Gap(Insets.xs),
                    Text(
                      pill.label,
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: selected
                            ? AppColors.onOrange
                            : AppColors.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (selected) ...[
                      const Gap(Insets.xs),
                      const Icon(
                        LucideIcons.check,
                        size: 14,
                        color: AppColors.onOrange,
                      ),
                    ],
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Hero card gradient cam + sóng + mascot Cóc.
class PlugProHeroCard extends StatelessWidget {
  const PlugProHeroCard({
    super.key,
    required this.tag,
    required this.title,
    required this.subtitle,
    required this.ctaLabel,
    required this.onCta,
    this.showMascot = true,
  });

  final String tag;
  final String title;
  final String subtitle;
  final String ctaLabel;
  final VoidCallback onCta;
  final bool showMascot;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: Insets.screenH),
      child: IntrinsicHeight(
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: double.infinity,
              padding: EdgeInsets.fromLTRB(
                Insets.xl,
                Insets.xl,
                showMascot ? 120 : Insets.xl,
                Insets.xl,
              ),
              decoration: BoxDecoration(
                gradient: AppColors.homeHeroGradient,
                borderRadius: BorderRadius.circular(28),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.25),
                      blurRadius: 24,
                      offset: const Offset(0, 10),
                    ),
                  ],
              ),
              child: Stack(
                children: [
                  Positioned.fill(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(28),
                      child: CustomPaint(painter: _HeroWavePainter()),
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: Insets.md,
                          vertical: Insets.xs,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.onOrange.withValues(alpha: 0.22),
                          borderRadius: BorderRadius.circular(Radii.full),
                        ),
                        child: Text(
                          tag,
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(
                                color: AppColors.onOrange,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                      ),
                      const Gap(Insets.md),
                      Text(
                        title,
                        style: Theme.of(context).textTheme.headlineSmall
                            ?.copyWith(
                              color: AppColors.onOrange,
                              fontWeight: FontWeight.w800,
                              height: 1.2,
                            ),
                      ),
                      const Gap(Insets.sm),
                      Text(
                        subtitle,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AppColors.onOrange.withValues(alpha: 0.88),
                          height: 1.45,
                        ),
                      ),
                      const Gap(Insets.lg),
                      Material(
                        color: AppColors.accent,
                        borderRadius: BorderRadius.circular(Radii.full),
                        child: InkWell(
                          onTap: onCta,
                          borderRadius: BorderRadius.circular(Radii.full),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: Insets.xl,
                              vertical: Insets.md,
                            ),
                            child: Text(
                              ctaLabel,
                              style: Theme.of(context).textTheme.labelLarge
                                  ?.copyWith(
                                    color: AppColors.onOrange,
                                    fontWeight: FontWeight.w700,
                                  ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            if (showMascot)
              Positioned(
                right: -4,
                bottom: -18,
                child: Image.asset(
                  AppAssets.cocVangLogoTransparent,
                  width: 130,
                  height: 130,
                  fit: BoxFit.contain,
                  filterQuality: FilterQuality.high,
                  gaplessPlayback: true,
                  errorBuilder: (_, __, ___) => const SizedBox(
                    width: 130,
                    height: 130,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _HeroWavePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.onOrange.withValues(alpha: 0.12)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;

    for (var wave = 0; wave < 3; wave++) {
      final path = Path();
      final baseY = size.height * (0.35 + wave * 0.12);
      final amp = 8.0 + wave * 4;
      path.moveTo(0, baseY);
      for (var x = 0.0; x <= size.width; x += 4) {
        final y = baseY +
            math.sin((x / size.width) * math.pi * 3 + wave) * amp;
        path.lineTo(x, y);
      }
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Hai ô thống kê nhỏ.
class PlugProStatsRow extends StatelessWidget {
  const PlugProStatsRow({
    super.key,
    required this.leftValue,
    required this.leftLabel,
    required this.rightValue,
    required this.rightLabel,
  });

  final int leftValue;
  final String leftLabel;
  final int rightValue;
  final String rightLabel;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: Insets.screenH),
      child: Row(
        children: [
          Expanded(child: _StatChip(value: leftValue, label: leftLabel)),
          const Gap(Insets.md),
          Expanded(child: _StatChip(value: rightValue, label: rightLabel)),
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({required this.value, required this.label});

  final int value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: Insets.lg,
        vertical: Insets.md,
      ),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.homeOrangeWash),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A211C18),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Text(
            '$value',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: AppColors.primary,
              fontWeight: FontWeight.w800,
            ),
          ),
          const Gap(Insets.sm),
          Expanded(
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Tiêu đề section + nút more.
class PlugProSectionHeader extends StatelessWidget {
  const PlugProSectionHeader({
    super.key,
    required this.title,
    this.onMoreTap,
    this.trailing,
  });

  final String title;
  final VoidCallback? onMoreTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        Insets.screenH,
        Insets.xl,
        Insets.screenH,
        Insets.md,
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          if (trailing != null)
            trailing!
          else if (onMoreTap != null)
            PlugProIconButton(
              icon: LucideIcons.moreHorizontal,
              onTap: onMoreTap,
            ),
        ],
      ),
    );
  }
}

enum PlugProServiceTab { primary, secondary, tertiary }

/// Tab con 3 nút (Hỏi AI / Quiz / Ôn tập …).
class PlugProServiceTabs extends StatelessWidget {
  const PlugProServiceTabs({
    super.key,
    required this.selected,
    required this.onSelected,
    required this.labels,
    this.icons = const [
      LucideIcons.sparkles,
      LucideIcons.clipboardList,
      LucideIcons.trendingUp,
    ],
  });

  final PlugProServiceTab selected;
  final ValueChanged<PlugProServiceTab> onSelected;
  final ({String primary, String secondary, String tertiary}) labels;
  final List<IconData> icons;

  @override
  Widget build(BuildContext context) {
    final tabs = [
      (PlugProServiceTab.primary, labels.primary, icons[0]),
      (PlugProServiceTab.secondary, labels.secondary, icons[1]),
      (PlugProServiceTab.tertiary, labels.tertiary, icons[2]),
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: Insets.screenH),
      child: Row(
        children: [
          for (var i = 0; i < tabs.length; i++) ...[
            if (i > 0) const Gap(Insets.sm),
            Expanded(
              child: _ServiceTabButton(
                label: tabs[i].$2,
                icon: tabs[i].$3,
                selected: selected == tabs[i].$1,
                onTap: () => onSelected(tabs[i].$1),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ServiceTabButton extends StatelessWidget {
  const _ServiceTabButton({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AppColors.primary : AppColors.card,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(
            vertical: Insets.md,
            horizontal: Insets.sm,
          ),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: selected
                ? null
                : Border.all(color: AppColors.homeOrangeWash, width: 1.5),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 16,
                color: selected ? AppColors.onOrange : AppColors.primary,
              ),
              const Gap(Insets.xs),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: selected
                        ? AppColors.onOrange
                        : AppColors.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Card cuộn ngang — môn học / dịch vụ / mentor.
class PlugProProviderCard extends StatelessWidget {
  const PlugProProviderCard({
    super.key,
    required this.title,
    required this.badge,
    required this.index,
    required this.onTap,
    this.subtitle,
    this.width = 168,
    /// Khóa ổn định (vd. courseId) — chọn gradient khác nhau theo môn.
    this.colorKey,
  });

  final String title;
  final String badge;
  final int index;
  final VoidCallback onTap;
  final String? subtitle;
  final double width;
  final String? colorKey;

  /// Gradient trang trí — tông rực, không bắt buộc trùng brand UI.
  static const _headerGradients = <List<Color>>[
    [Color(0xFF0061FF), Color(0xFF00C9FF)],
    [Color(0xFFFF512F), Color(0xFFFF8A00)],
    [Color(0xFF11998E), Color(0xFF38EF7D)],
    [Color(0xFF8E2DE2), Color(0xFF4A00E0)],
    [Color(0xFFFC466B), Color(0xFF3F5EFB)],
    [Color(0xFF0ACFFE), Color(0xFF495AFF)],
    [Color(0xFFF7971E), Color(0xFFFFC837)],
    [Color(0xFF667EEA), Color(0xFF764BA2)],
    [Color(0xFFED213A), Color(0xFF93291E)],
    [Color(0xFF00B4DB), Color(0xFF0083B0)],
    [Color(0xFFF953C6), Color(0xFFB91D73)],
    [Color(0xFF1FA2FF), Color(0xFF12D8FA)],
    [Color(0xFF56AB2F), Color(0xFFA8E063)],
    [Color(0xFFE44D26), Color(0xFFF16529)],
    [Color(0xFF4776E6), Color(0xFF8E54E9)],
    [Color(0xFF00B09B), Color(0xFF96C93D)],
    [Color(0xFFFF6B6B), Color(0xFFEE5A24)],
    [Color(0xFF2BC0E4), Color(0xFF0E7490)],
    [Color(0xFF8360C3), Color(0xFF2EBF91)],
    [Color(0xFFFF0080), Color(0xFF7928CA)],
  ];

  static List<Color> headerGradientFor(String key) {
    final seed = Object.hash(key, key.codeUnits.fold<int>(0, (a, c) => a + c));
    final i = seed.abs() % _headerGradients.length;
    return _headerGradients[i];
  }

  @override
  Widget build(BuildContext context) {
    final gradient = headerGradientFor(colorKey ?? badge);

    return SizedBox(
      width: width,
      child: Material(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(24),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(24),
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: AppColors.homeOrangeWash),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x0F211C18),
                  blurRadius: 16,
                  offset: Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 100,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: gradient,
                    ),
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(24),
                    ),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    badge,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      color: AppColors.onOrange,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1,
                      shadows: const [
                        Shadow(
                          color: Color(0x40000000),
                          blurRadius: 8,
                          offset: Offset(0, 2),
                        ),
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    Insets.md,
                    Insets.md,
                    Insets.md,
                    Insets.lg,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w800,
                          height: 1.25,
                        ),
                      ),
                      const Gap(Insets.xs),
                      Row(
                        children: [
                          const Icon(
                            LucideIcons.star,
                            size: 14,
                            color: AppColors.primary,
                          ),
                          const Gap(4),
                          Text(
                            badge,
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w600,
                                ),
                          ),
                        ],
                      ),
                      if (subtitle != null && subtitle!.isNotEmpty) ...[
                        const Gap(Insets.xs),
                        Text(
                          subtitle!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppColors.textTertiary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Card nội dung chuẩn PlugPro — viền cam nhạt, bo góc lớn.
class PlugProCard extends StatelessWidget {
  const PlugProCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsets? padding;

  @override
  Widget build(BuildContext context) {
    final card = Container(
      padding: padding ?? const EdgeInsets.all(Insets.lg),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.homeOrangeWash),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A211C18),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: child,
    );

    if (onTap == null) return card;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: card,
      ),
    );
  }
}
