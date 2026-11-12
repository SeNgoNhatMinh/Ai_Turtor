import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:gap/gap.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/constants/app_assets.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/models/course.dart';
import '../../../../shared/widgets/fpt_logo.dart';

/// Header và hero học tập — giữ nhận diện FPT nhưng ưu tiên hành động chính.
class PlanAHomeHero extends StatelessWidget {
  const PlanAHomeHero({
    super.key,
    required this.title,
    required this.subtitle,
    required this.ctaLabel,
    required this.onCta,
    this.action,
  });

  final String title;
  final String subtitle;
  final String ctaLabel;
  final VoidCallback onCta;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final topPad = MediaQuery.paddingOf(context).top + Insets.sm;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: Padding(
        padding: EdgeInsets.fromLTRB(Insets.screenH, topPad, Insets.screenH, 0),
        child: Column(
          children: [
            Row(
              children: [
                const FptLogo(height: 28),
                const Spacer(),
                if (action != null) action!,
              ],
            ),
            const Gap(Insets.sm),
            ClipRRect(
              borderRadius: BorderRadius.circular(Radii.xl),
              child: SizedBox(
                height: 248,
                width: double.infinity,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Image.asset(
                      AppAssets.homeHeroFptu,
                      fit: BoxFit.cover,
                      alignment: Alignment.centerRight,
                      filterQuality: FilterQuality.high,
                    ),
                    const DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.centerLeft,
                          end: Alignment.centerRight,
                          colors: [
                            Color(0xFF0A3A73),
                            Color(0xF20A56A0),
                            Color(0xC20A56A0),
                            Color(0x260A56A0),
                          ],
                          stops: [0.0, 0.42, 0.64, 1.0],
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(Insets.lg),
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 224),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                title,
                                maxLines: 3,
                                overflow: TextOverflow.ellipsis,
                                style: textTheme.headlineSmall?.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w800,
                                  height: 1.16,
                                  fontSize: 21,
                                  letterSpacing: -0.35,
                                ),
                              ),
                              const Gap(Insets.sm),
                              Text(
                                subtitle,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: textTheme.bodySmall?.copyWith(
                                  color: Colors.white.withValues(alpha: 0.9),
                                  fontWeight: FontWeight.w500,
                                  height: 1.35,
                                ),
                              ),
                              const Gap(Insets.md),
                              Semantics(
                                button: true,
                                label: ctaLabel,
                                child: Material(
                                  color: AppColors.fptOrange,
                                  borderRadius: BorderRadius.circular(
                                    Radii.full,
                                  ),
                                  child: InkWell(
                                    onTap: onCta,
                                    borderRadius: BorderRadius.circular(
                                      Radii.full,
                                    ),
                                    child: Padding(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: Insets.lg,
                                        vertical: Insets.md,
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Flexible(
                                            child: Text(
                                              ctaLabel,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: textTheme.labelLarge
                                                  ?.copyWith(
                                                    color: Colors.white,
                                                    fontWeight: FontWeight.w700,
                                                  ),
                                            ),
                                          ),
                                          const Gap(Insets.sm),
                                          const Icon(
                                            LucideIcons.arrowRight,
                                            size: 16,
                                            color: Colors.white,
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Search trắng bo góc — mockup: "Bạn muốn học gì hôm nay?"
class PlanASearchField extends StatelessWidget {
  const PlanASearchField({
    super.key,
    required this.hint,
    required this.controller,
  });

  final String hint;
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      textField: true,
      label: hint,
      child: Material(
        color: AppColors.card,
        elevation: 2,
        shadowColor: const Color(0x1A000000),
        borderRadius: BorderRadius.circular(Radii.lg),
        child: TextField(
          controller: controller,
          textInputAction: TextInputAction.search,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: AppColors.textTertiary),
            prefixIcon: const Icon(
              LucideIcons.search,
              size: 20,
              color: AppColors.textTertiary,
            ),
            suffixIcon: controller.text.isEmpty
                ? null
                : IconButton(
                    tooltip: 'Xóa tìm kiếm',
                    onPressed: controller.clear,
                    icon: const Icon(LucideIcons.x, size: 18),
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
    );
  }
}

/// Stats 2 cột + icon + divider dọc — giống mockup trái.
class PlanAIconStats extends StatelessWidget {
  const PlanAIconStats({
    super.key,
    required this.questionsAsked,
    required this.questionsLabel,
    required this.courseCount,
    required this.coursesLabel,
  });

  final int questionsAsked;
  final String questionsLabel;
  final int courseCount;
  final String coursesLabel;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: Insets.screenH),
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: Insets.lg,
          vertical: Insets.md,
        ),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(Radii.lg),
          border: Border.all(color: AppColors.borderHairline),
        ),
        child: IntrinsicHeight(
          child: Row(
            children: [
              Expanded(
                child: _StatCell(
                  icon: LucideIcons.messageCircle,
                  value: questionsAsked,
                  label: questionsLabel,
                  theme: textTheme,
                ),
              ),
              const VerticalDivider(
                width: 24,
                thickness: 1,
                color: AppColors.borderHairline,
              ),
              Expanded(
                child: _StatCell(
                  icon: LucideIcons.bookOpen,
                  value: courseCount,
                  label: coursesLabel,
                  theme: textTheme,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatCell extends StatelessWidget {
  const _StatCell({
    required this.icon,
    required this.value,
    required this.label,
    required this.theme,
  });

  final IconData icon;
  final int value;
  final String label;
  final TextTheme theme;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 22, color: AppColors.fptBlue),
        const Gap(Insets.sm),
        Expanded(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '$value',
                style: theme.titleLarge?.copyWith(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w800,
                  height: 1,
                ),
              ),
              const Gap(2),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class PlanACourseCard extends StatelessWidget {
  const PlanACourseCard({
    super.key,
    required this.course,
    required this.index,
    required this.onTap,
  });

  final Course course;
  final int index;
  final VoidCallback onTap;

  static const _themes = [
    _CourseArtTheme(
      bg: Color(0xFFEBF2FF),
      accent: AppColors.fptBlue,
      art: AppAssets.courseArtCampus,
    ),
    _CourseArtTheme(
      bg: Color(0xFFE8F6EE),
      accent: AppColors.fptGreen,
      art: AppAssets.courseArtLaptop,
    ),
    _CourseArtTheme(
      bg: Color(0xFFFFF1E8),
      accent: AppColors.fptOrange,
      art: AppAssets.courseArtBooks,
    ),
    _CourseArtTheme(
      bg: Color(0xFFF3E8FF),
      accent: Color(0xFF7C3AED),
      art: AppAssets.courseArtMath,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final theme = _themes[index % _themes.length];
    final title = course.name.isNotEmpty ? course.name : course.code;
    final cardWidth = ((MediaQuery.sizeOf(context).width - 44) / 2).clamp(
      156.0,
      196.0,
    );

    return Semantics(
      button: true,
      label: '${course.code}, $title',
      hint: 'Mở AI Tutor cho môn học này',
      child: SizedBox(
        width: cardWidth,
        child: Material(
          color: AppColors.card,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(Radii.lg),
            side: const BorderSide(color: AppColors.borderHairline),
          ),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  height: 100,
                  width: double.infinity,
                  child: ColoredBox(
                    color: theme.bg,
                    child: Stack(
                      children: [
                        Positioned.fill(
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(8, 28, 8, 4),
                            child: Image.asset(
                              theme.art,
                              fit: BoxFit.contain,
                              alignment: Alignment.bottomCenter,
                              filterQuality: FilterQuality.high,
                            ),
                          ),
                        ),
                        Positioned(
                          top: 10,
                          left: 12,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              color: theme.accent.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(Radii.full),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: Insets.sm,
                                vertical: Insets.xs,
                              ),
                              child: Text(
                                course.code,
                                style: textTheme.labelLarge?.copyWith(
                                  color: theme.accent,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      Insets.md,
                      Insets.sm,
                      Insets.sm,
                      Insets.sm,
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            title,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: textTheme.titleSmall?.copyWith(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w800,
                              height: 1.2,
                            ),
                          ),
                        ),
                        const Gap(Insets.xs),
                        Container(
                          width: 32,
                          height: 32,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: theme.accent.withValues(alpha: 0.08),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            LucideIcons.arrowRight,
                            size: 16,
                            color: theme.accent,
                          ),
                        ),
                      ],
                    ),
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

class _CourseArtTheme {
  const _CourseArtTheme({
    required this.bg,
    required this.accent,
    required this.art,
  });

  final Color bg;
  final Color accent;
  final String art;
}

class PlanAQuickAction {
  const PlanAQuickAction({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
}

/// Lối tắt student — đồng bộ web dashboard quick grid.
class PlanAQuickActions extends StatelessWidget {
  const PlanAQuickActions({super.key, required this.actions});

  final List<PlanAQuickAction> actions;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: Insets.screenH),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Truy cập nhanh',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: AppColors.primary,
              fontWeight: FontWeight.w800,
            ),
          ),
          const Gap(Insets.md),
          SizedBox(
            height: 108,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              clipBehavior: Clip.none,
              itemCount: actions.length,
              separatorBuilder: (_, __) => const Gap(Insets.sm),
              itemBuilder: (context, index) {
                final action = actions[index];
                return Semantics(
                  button: true,
                  label: action.title,
                  hint: action.subtitle,
                  child: SizedBox(
                    width: 98,
                    child: Material(
                      color: action.color.withValues(alpha: 0.07),
                      borderRadius: BorderRadius.circular(Radii.lg),
                      child: InkWell(
                        onTap: action.onTap,
                        borderRadius: BorderRadius.circular(Radii.lg),
                        child: Container(
                          padding: const EdgeInsets.all(Insets.sm),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(Radii.lg),
                            border: Border.all(
                              color: action.color.withValues(alpha: 0.12),
                            ),
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(action.icon, color: action.color, size: 26),
                              const Gap(Insets.sm),
                              Text(
                                action.title,
                                maxLines: 2,
                                textAlign: TextAlign.center,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.labelLarge
                                    ?.copyWith(
                                      color: AppColors.primary,
                                      fontWeight: FontWeight.w700,
                                      height: 1.15,
                                    ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
