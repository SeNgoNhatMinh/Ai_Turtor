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

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final topPad = MediaQuery.paddingOf(context).top + Insets.md;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: Padding(
        padding: EdgeInsets.fromLTRB(Insets.screenH, topPad, Insets.screenH, 0),
        child: Column(
          children: [
            Row(
              children: [
                const FptLogo(height: 34),
                const Gap(Insets.md),
                Expanded(
                  child: Column(
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
                  ),
                ),
                if (action != null) action!,
              ],
            ),
            const Gap(Insets.md),
            LayoutBuilder(
              builder: (context, constraints) {
                final mascotWidth = (constraints.maxWidth * 0.42).clamp(
                  132.0,
                  158.0,
                );
                final copyWidth = (constraints.maxWidth - mascotWidth + 12)
                    .clamp(176.0, 224.0);

                return Container(
                  height: 194,
                  width: double.infinity,
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [AppColors.primary, AppColors.primaryTint],
                    ),
                    borderRadius: BorderRadius.circular(Radii.xl),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withValues(alpha: 0.14),
                        blurRadius: 22,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: Stack(
                    children: [
                      Positioned(
                        right: -54,
                        top: -74,
                        child: Container(
                          width: 188,
                          height: 188,
                          decoration: BoxDecoration(
                            color: AppColors.fptOrange.withValues(alpha: 0.2),
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                      Positioned(
                        right: -4,
                        bottom: -8,
                        width: mascotWidth,
                        height: 166,
                        child: Image.asset(
                          AppAssets.cocVangLogoTransparent,
                          fit: BoxFit.contain,
                          alignment: Alignment.bottomCenter,
                          filterQuality: FilterQuality.high,
                          gaplessPlayback: true,
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(Insets.lg),
                        child: SizedBox(
                          width: copyWidth,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                title,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: textTheme.headlineSmall?.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  height: 1.15,
                                  fontSize: 21,
                                  letterSpacing: -0.3,
                                ),
                              ),
                              const Gap(Insets.sm),
                              Text(
                                subtitle,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: textTheme.bodySmall?.copyWith(
                                  color: Colors.white.withValues(alpha: 0.86),
                                  fontWeight: FontWeight.w500,
                                  height: 1.35,
                                ),
                              ),
                              const Gap(Insets.md),
                              Semantics(
                                button: true,
                                label: ctaLabel,
                                child: Material(
                                  color: AppColors.accentDark,
                                  borderRadius: BorderRadius.circular(Radii.md),
                                  child: InkWell(
                                    onTap: onCta,
                                    borderRadius: BorderRadius.circular(
                                      Radii.md,
                                    ),
                                    child: Padding(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: Insets.md,
                                        vertical: Insets.md,
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const Icon(
                                            LucideIcons.messageCircle,
                                            size: 17,
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
                                                    fontWeight: FontWeight.w700,
                                                  ),
                                            ),
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
        borderRadius: BorderRadius.circular(Radii.lg),
        child: Container(
          height: 48,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(Radii.lg),
            border: Border.all(color: AppColors.borderStrong),
          ),
          child: TextField(
            controller: controller,
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
    this.title = 'Công cụ học tập',
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
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: actions.length,
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: actions.length.clamp(1, 4),
              mainAxisExtent: 88,
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
                  color: AppColors.card,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(Radii.lg),
                    side: const BorderSide(color: AppColors.borderHairline),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: action.onTap,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: Insets.xs,
                        vertical: Insets.sm,
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 36,
                            height: 36,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: action.color.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(Radii.md),
                            ),
                            child: Icon(
                              action.icon,
                              color: action.color,
                              size: 20,
                            ),
                          ),
                          const Gap(Insets.sm),
                          Text(
                            action.title,
                            maxLines: 1,
                            textAlign: TextAlign.center,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.labelMedium
                                ?.copyWith(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                        ],
                      ),
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
