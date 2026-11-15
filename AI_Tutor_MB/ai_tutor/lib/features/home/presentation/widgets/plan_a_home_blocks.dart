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
    required this.studentName,
    required this.title,
    required this.subtitle,
    required this.ctaLabel,
    required this.onCta,
    this.action,
  });

  final String studentName;
  final String title;
  final String subtitle;
  final String ctaLabel;
  final VoidCallback onCta;
  final Widget? action;

  static const _courseHeroAsset = 'assets/images/home_course_fptu_mascot.png';

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final topPad = MediaQuery.paddingOf(context).top + Insets.md;
    final pageTextScale = MediaQuery.textScalerOf(context).scale(1);
    final brand = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const FptLogo(height: 30),
        const Gap(Insets.sm),
        Container(width: 1, height: 30, color: AppColors.borderStrong),
        const Gap(Insets.sm),
        Text(
          'AI Tutor',
          style: textTheme.labelLarge?.copyWith(
            color: AppColors.primary,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
    final greeting = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Xin chào',
          style: textTheme.labelSmall?.copyWith(
            color: AppColors.textSecondary,
            fontWeight: FontWeight.w600,
          ),
        ),
        Text(
          studentName,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: textTheme.titleSmall?.copyWith(
            color: AppColors.primary,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: Padding(
        padding: EdgeInsets.fromLTRB(Insets.screenH, topPad, Insets.screenH, 0),
        child: Column(
          children: [
            LayoutBuilder(
              builder: (context, constraints) {
                if (pageTextScale > 1.4) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          brand,
                          const Spacer(),
                          if (action != null) action!,
                        ],
                      ),
                      const Gap(Insets.sm),
                      greeting,
                    ],
                  );
                }

                return Row(
                  children: [
                    brand,
                    const Gap(Insets.md),
                    Expanded(child: greeting),
                    if (action != null) action!,
                  ],
                );
              },
            ),
            const Gap(Insets.md),
            LayoutBuilder(
              builder: (context, constraints) {
                final mascotWidth = (constraints.maxWidth * 0.42).clamp(
                  132.0,
                  158.0,
                );
                final textScale = MediaQuery.textScalerOf(
                  context,
                ).scale(1).clamp(1.0, 2.0);
                final heroHeight = 274 + ((textScale - 1) * 64);

                return Container(
                  height: heroHeight,
                  width: double.infinity,
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [AppColors.accentWash, AppColors.infoBg],
                    ),
                    borderRadius: BorderRadius.circular(Radii.xl),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.info.withValues(alpha: 0.16),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Stack(
                    children: [
                      Positioned.fill(
                        child: Image.asset(
                          _courseHeroAsset,
                          fit: BoxFit.cover,
                          alignment: Alignment.centerRight,
                          filterQuality: FilterQuality.high,
                          gaplessPlayback: true,
                          errorBuilder: (context, error, stackTrace) =>
                              const SizedBox.shrink(),
                        ),
                      ),
                      Positioned.fill(
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.centerLeft,
                              end: Alignment.centerRight,
                              colors: [
                                AppColors.accentWash.withValues(alpha: 0.98),
                                AppColors.accentWash.withValues(alpha: 0.86),
                                AppColors.infoBg.withValues(alpha: 0.2),
                              ],
                              stops: const [0, 0.48, 1],
                            ),
                          ),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(Insets.lg),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: Insets.sm,
                                vertical: Insets.xs,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.card.withValues(alpha: 0.94),
                                borderRadius: BorderRadius.circular(Radii.full),
                                border: Border.all(
                                  color: AppColors.borderHairline,
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Container(
                                    width: 8,
                                    height: 8,
                                    decoration: const BoxDecoration(
                                      color: AppColors.fptOrange,
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                  const Gap(Insets.sm),
                                  Flexible(
                                    child: Text(
                                      'Môn đang học',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: textTheme.labelMedium?.copyWith(
                                        color: AppColors.info,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const Gap(Insets.md),
                            ConstrainedBox(
                              constraints: BoxConstraints(
                                maxWidth:
                                    constraints.maxWidth - mascotWidth / 2,
                              ),
                              child: Text(
                                title,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: textTheme.headlineSmall?.copyWith(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w800,
                                  height: 1.14,
                                  letterSpacing: -0.35,
                                ),
                              ),
                            ),
                            const Gap(Insets.sm),
                            Text(
                              subtitle,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: textTheme.bodyMedium?.copyWith(
                                color: AppColors.textSecondary,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const Spacer(),
                            Semantics(
                              button: true,
                              label: ctaLabel,
                              child: Material(
                                color: AppColors.info,
                                borderRadius: BorderRadius.circular(Radii.lg),
                                clipBehavior: Clip.antiAlias,
                                child: InkWell(
                                  onTap: onCta,
                                  child: ConstrainedBox(
                                    constraints: const BoxConstraints(
                                      minHeight: 52,
                                    ),
                                    child: Padding(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: Insets.md,
                                        vertical: Insets.sm,
                                      ),
                                      child: Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.center,
                                        children: [
                                          const Icon(
                                            LucideIcons.messageCircle,
                                            size: 20,
                                            color: Colors.white,
                                          ),
                                          const Gap(Insets.sm),
                                          Flexible(
                                            child: Text(
                                              ctaLabel,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: textTheme.labelLarge
                                                  ?.copyWith(
                                                    color: Colors.white,
                                                    fontWeight: FontWeight.w800,
                                                  ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
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
    this.focusNode,
  });

  final String hint;
  final TextEditingController controller;
  final FocusNode? focusNode;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      textField: true,
      label: hint,
      child: Material(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(Radii.lg),
        child: Container(
          height: 48,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(Radii.lg),
            border: Border.all(color: AppColors.borderStrong),
          ),
          child: TextField(
            controller: controller,
            focusNode: focusNode,
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: AppColors.textSecondary),
              prefixIcon: const Icon(
                LucideIcons.search,
                size: 20,
                color: AppColors.textSecondary,
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
    this.selected = false,
  });

  final Course course;
  final int index;
  final VoidCallback onTap;
  final bool selected;

  static const _themes = [
    _CourseArtTheme(bg: Color(0xFFEBF2FF), art: AppAssets.courseArtCampus),
    _CourseArtTheme(bg: Color(0xFFE8F6EE), art: AppAssets.courseArtLaptop),
    _CourseArtTheme(bg: Color(0xFFFFF1E8), art: AppAssets.courseArtBooks),
    _CourseArtTheme(bg: Color(0xFFF3E8FF), art: AppAssets.courseArtMath),
  ];

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final theme = _themes[index % _themes.length];
    final title = course.name.isNotEmpty ? course.name : course.code;
    final cardWidth = (MediaQuery.sizeOf(context).width - 78)
        .clamp(236.0, 268.0)
        .toDouble();
    final className = course.className?.trim();

    return Semantics(
      button: true,
      selected: selected,
      label: '${course.code}, $title',
      hint: 'Mở AI Tutor cho môn học này',
      child: SizedBox(
        width: cardWidth,
        height: 96,
        child: Material(
          color: AppColors.card,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(Radii.lg),
            side: BorderSide(
              color: selected
                  ? AppColors.fptOrange.withValues(alpha: 0.72)
                  : AppColors.borderHairline,
              width: selected ? 1.5 : 1,
            ),
          ),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.all(Insets.md),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Container(
                    width: 66,
                    height: 66,
                    padding: const EdgeInsets.all(Insets.xs),
                    decoration: BoxDecoration(
                      color: theme.bg,
                      borderRadius: BorderRadius.circular(Radii.md),
                    ),
                    child: Image.asset(
                      theme.art,
                      fit: BoxFit.contain,
                      filterQuality: FilterQuality.high,
                    ),
                  ),
                  const Gap(Insets.md),
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: textTheme.titleSmall?.copyWith(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w700,
                            height: 1.22,
                          ),
                        ),
                        const Gap(Insets.xs),
                        Text(
                          [
                            course.code,
                            if (className != null && className.isNotEmpty)
                              className,
                          ].join(' · '),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: textTheme.labelSmall?.copyWith(
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _CourseArtTheme {
  const _CourseArtTheme({required this.bg, required this.art});

  final Color bg;
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
  const PlanAQuickActions({
    super.key,
    required this.actions,
    this.title = 'Tiện ích học tập',
  });

  final List<PlanAQuickAction> actions;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: Insets.screenH),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: AppColors.primary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const Gap(Insets.sm),
          LayoutBuilder(
            builder: (context, constraints) {
              final textScale = MediaQuery.textScalerOf(
                context,
              ).scale(1).clamp(1.0, 2.0);
              final itemHeight = 126 + ((textScale - 1) * 34);

              return GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: actions.length,
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: actions.length == 1 ? 1 : 2,
                  mainAxisExtent: itemHeight,
                  crossAxisSpacing: Insets.sm,
                  mainAxisSpacing: Insets.sm,
                ),
                itemBuilder: (context, index) {
                  final action = actions[index];
                  return Semantics(
                    button: true,
                    label: action.title,
                    hint: action.subtitle,
                    child: Material(
                      color: action.color.withValues(alpha: 0.08),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(Radii.lg),
                        side: const BorderSide(color: AppColors.borderHairline),
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: InkWell(
                        onTap: action.onTap,
                        child: Padding(
                          padding: const EdgeInsets.all(Insets.md),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 42,
                                height: 42,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: AppColors.card.withValues(alpha: 0.92),
                                  borderRadius: BorderRadius.circular(Radii.md),
                                ),
                                child: Icon(
                                  action.icon,
                                  color: action.color,
                                  size: 22,
                                ),
                              ),
                              const Gap(Insets.sm),
                              Text(
                                action.title,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.labelLarge
                                    ?.copyWith(
                                      color: AppColors.primary,
                                      fontWeight: FontWeight.w800,
                                    ),
                              ),
                              const Gap(Insets.xs),
                              Expanded(
                                child: Text(
                                  action.subtitle,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: Theme.of(context).textTheme.bodySmall
                                      ?.copyWith(
                                        color: AppColors.textSecondary,
                                        fontWeight: FontWeight.w500,
                                      ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ],
      ),
    );
  }
}
