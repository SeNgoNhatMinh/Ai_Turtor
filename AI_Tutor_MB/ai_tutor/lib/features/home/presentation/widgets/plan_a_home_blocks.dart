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

/// Hero home — banner FPTU 3D + overlay chữ / CTA.
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
    final topPad = MediaQuery.paddingOf(context).top + Insets.md;
    final titleParts = _splitHeadline(title);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 340),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned.fill(
              child: Image.asset(
                AppAssets.homeHeroFptu,
                fit: BoxFit.cover,
                alignment: Alignment.centerRight,
                filterQuality: FilterQuality.high,
              ),
            ),
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                    colors: [
                      Colors.white,
                      Colors.white.withValues(alpha: 0.94),
                      Colors.white.withValues(alpha: 0.35),
                      Colors.transparent,
                    ],
                    stops: const [0.0, 0.34, 0.52, 0.78],
                  ),
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(
                Insets.screenH,
                topPad,
                Insets.screenH,
                Insets.xl,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const FptLogo(height: 26),
                      const Spacer(),
                      if (action != null) action!,
                    ],
                  ),
                  const Gap(Insets.lg),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 280),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text.rich(
                          TextSpan(
                            children: [
                              TextSpan(
                                text: titleParts.$1,
                                style: textTheme.headlineSmall?.copyWith(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w800,
                                  height: 1.2,
                                  fontSize: 22,
                                ),
                              ),
                              TextSpan(
                                text: titleParts.$2,
                                style: textTheme.headlineSmall?.copyWith(
                                  color: AppColors.fptOrange,
                                  fontWeight: FontWeight.w800,
                                  height: 1.2,
                                  fontSize: 22,
                                ),
                              ),
                            ],
                          ),
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const Gap(Insets.sm),
                        Text(
                          subtitle,
                          style: textTheme.bodyMedium?.copyWith(
                            color: AppColors.textSecondary,
                            height: 1.4,
                          ),
                        ),
                        const Gap(Insets.md),
                        Material(
                          color: AppColors.fptOrange,
                          borderRadius: BorderRadius.circular(Radii.full),
                          child: InkWell(
                            onTap: onCta,
                            borderRadius: BorderRadius.circular(Radii.full),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: Insets.xl,
                                vertical: Insets.md,
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    ctaLabel,
                                    style: textTheme.labelLarge?.copyWith(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700,
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
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// "Hôm nay học gì nào?" → ("Hôm nay ", "học gì nào?")
  static (String, String) _splitHeadline(String title) {
    const marker = 'học';
    final i = title.toLowerCase().indexOf(marker);
    if (i <= 0) return (title, '');
    return (title.substring(0, i), title.substring(i));
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
    return Material(
      color: AppColors.card,
      elevation: 2,
      shadowColor: const Color(0x1A000000),
      borderRadius: BorderRadius.circular(Radii.lg),
      child: TextField(
        controller: controller,
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
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: Insets.md,
            vertical: Insets.md,
          ),
        ),
        style: Theme.of(context).textTheme.bodyMedium,
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
          child: Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: '$value ',
                  style: theme.titleMedium?.copyWith(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                TextSpan(
                  text: label,
                  style: theme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
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

  /// Mỗi thẻ trong rail dùng bộ (màu + line-art) khác nhau.
  static _CourseArtTheme themeFor(int index) => _themes[index % _themes.length];

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final theme = themeFor(index);
    final title = course.name.isNotEmpty ? course.name : course.code;

    return SizedBox(
      width: 196,
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
                height: 108,
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
                        child: Text(
                          course.code,
                          style: textTheme.labelLarge?.copyWith(
                            color: theme.accent,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  Insets.md,
                  Insets.sm,
                  Insets.md,
                  Insets.md,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: textTheme.titleSmall?.copyWith(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w800,
                        height: 1.25,
                      ),
                    ),
                  ],
                ),
              ),
            ],
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
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: actions.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: Insets.md,
              crossAxisSpacing: Insets.md,
              mainAxisExtent: 168,
            ),
            itemBuilder: (context, index) {
              final action = actions[index];
              return Material(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(Radii.lg),
                child: InkWell(
                  onTap: action.onTap,
                  borderRadius: BorderRadius.circular(Radii.lg),
                  child: Container(
                    padding: const EdgeInsets.all(Insets.md),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(Radii.lg),
                      border: Border.all(color: AppColors.borderHairline),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: action.color.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(Radii.md),
                          ),
                          child: Icon(
                            action.icon,
                            color: action.color,
                            size: 20,
                          ),
                        ),
                        const Gap(Insets.md),
                        Text(
                          action.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const Gap(Insets.xs),
                        Text(
                          action.subtitle,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(color: AppColors.textTertiary),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
