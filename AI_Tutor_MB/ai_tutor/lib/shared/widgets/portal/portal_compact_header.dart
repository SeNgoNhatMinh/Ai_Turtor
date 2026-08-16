import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:gap/gap.dart';

import '../../../core/constants/app_assets.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';

enum PortalHeaderStyle { greeting, title, profile }

/// Header tab — nền navy (profile) hoặc sáng (home greeting).
class PortalCompactHeader extends StatelessWidget {
  const PortalCompactHeader({
    super.key,
    required this.style,
    this.eyebrow,
    this.title,
    this.subtitle,
    this.leading,
    this.actions = const [],
    this.profileAvatar,
  });

  const PortalCompactHeader.greeting({
    super.key,
    required String eyebrow,
    required String title,
    this.actions = const [],
  })  : style = PortalHeaderStyle.greeting,
        eyebrow = eyebrow,
        title = title,
        subtitle = null,
        leading = null,
        profileAvatar = null;

  const PortalCompactHeader.title({
    super.key,
    required String title,
    this.subtitle,
    this.actions = const [],
  })  : style = PortalHeaderStyle.title,
        eyebrow = null,
        title = title,
        leading = null,
        profileAvatar = null;

  const PortalCompactHeader.profile({
    super.key,
    required String title,
    required String subtitle,
    this.profileAvatar,
  })  : style = PortalHeaderStyle.profile,
        eyebrow = null,
        title = title,
        this.subtitle = subtitle,
        leading = null,
        actions = const [];

  final PortalHeaderStyle style;
  final String? eyebrow;
  final String? title;
  final String? subtitle;
  final Widget? leading;
  final List<Widget> actions;
  final Widget? profileAvatar;

  @override
  Widget build(BuildContext context) {
    final topPad = MediaQuery.paddingOf(context).top;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: style == PortalHeaderStyle.profile
          ? SystemUiOverlayStyle.light
          : SystemUiOverlayStyle.dark,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: style == PortalHeaderStyle.profile
              ? const LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [AppColors.primary, AppColors.primaryTint],
                )
              : const LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [AppColors.homeBgTop, AppColors.homeBgBottom],
                ),
        ),
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            Insets.screenH,
            topPad + Insets.md,
            Insets.screenH,
            Insets.lg,
          ),
          child: switch (style) {
            PortalHeaderStyle.profile => _ProfileContent(
              title: title ?? '',
              subtitle: subtitle ?? '',
              avatar: profileAvatar ?? _defaultAvatar(),
            ),
            PortalHeaderStyle.greeting => _GreetingContent(
              eyebrow: eyebrow ?? '',
              title: title ?? '',
              leading: leading ?? _defaultAvatar(compact: true),
              actions: actions,
            ),
            PortalHeaderStyle.title => _TitleContent(
              title: title ?? '',
              subtitle: subtitle,
              actions: actions,
            ),
          },
        ),
      ),
    );
  }

  Widget _defaultAvatar({bool compact = false}) {
    final size = compact ? 52.0 : 88.0;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(compact ? 16 : 22),
        border: Border.all(color: AppColors.borderHairline, width: 1.5),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0F211C18),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
      padding: EdgeInsets.all(compact ? 6 : Insets.sm),
      child: Image.asset(
        AppAssets.cocVangLogoTransparent,
        fit: BoxFit.contain,
        errorBuilder: (_, __, ___) => Image.asset(
          AppAssets.cocVangLogo,
          fit: BoxFit.contain,
        ),
      ),
    );
  }
}

class _GreetingContent extends StatelessWidget {
  const _GreetingContent({
    required this.eyebrow,
    required this.title,
    required this.leading,
    required this.actions,
  });

  final String eyebrow;
  final String title;
  final Widget leading;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        leading,
        const Gap(Insets.md),
        Expanded(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                eyebrow,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.textSecondary,
                  fontSize: 14,
                ),
              ),
              Text(
                title,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                  fontSize: 20,
                  color: AppColors.textPrimary,
                  height: 1.2,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
        ...actions,
      ],
    );
  }
}

class _TitleContent extends StatelessWidget {
  const _TitleContent({
    required this.title,
    this.subtitle,
    required this.actions,
  });

  final String title;
  final String? subtitle;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Image.asset(
          AppAssets.cocVangLogoTransparent,
          width: 40,
          height: 40,
          fit: BoxFit.contain,
          errorBuilder: (_, __, ___) => Image.asset(
            AppAssets.cocVangLogo,
            width: 40,
            height: 40,
            fit: BoxFit.contain,
          ),
        ),
        const Gap(Insets.md),
        Expanded(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                  height: 1.15,
                ),
              ),
              if (subtitle != null) ...[
                const Gap(Insets.xs),
                Text(
                  subtitle!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                    height: 1.3,
                  ),
                ),
              ],
            ],
          ),
        ),
        ...actions,
      ],
    );
  }
}

class _ProfileContent extends StatelessWidget {
  const _ProfileContent({
    required this.title,
    required this.subtitle,
    required this.avatar,
  });

  final String title;
  final String subtitle;
  final Widget avatar;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        avatar,
        const Gap(Insets.md),
        Text(
          title,
          textAlign: TextAlign.center,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            color: AppColors.onOrange,
            fontWeight: FontWeight.w800,
          ),
        ),
        const Gap(Insets.xs),
        Container(
          padding: const EdgeInsets.symmetric(
            horizontal: Insets.lg,
            vertical: Insets.xs + 2,
          ),
          decoration: BoxDecoration(
            color: AppColors.onOrange.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(Radii.full),
            border: Border.all(
              color: AppColors.onOrange.withValues(alpha: 0.35),
            ),
          ),
          child: Text(
            subtitle,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: AppColors.onOrange.withValues(alpha: 0.95),
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}
