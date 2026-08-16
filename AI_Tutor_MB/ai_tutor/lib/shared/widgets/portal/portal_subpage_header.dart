import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../plugpro/plugpro_design_system.dart';

/// App bar màn con — nền sáng, chữ tối, nút back viền cam.
class PortalSubpageHeader extends StatelessWidget implements PreferredSizeWidget {
  const PortalSubpageHeader({
    super.key,
    required this.title,
    this.leading,
    this.actions,
    this.bottom,
  });

  final String title;
  final Widget? leading;
  final List<Widget>? actions;
  final PreferredSizeWidget? bottom;

  static const _toolbarH = 56.0;

  @override
  Size get preferredSize {
    final bottomH = bottom?.preferredSize.height ?? 0;
    return Size.fromHeight(_toolbarH + bottomH);
  }

  @override
  Widget build(BuildContext context) {
    final topPad = MediaQuery.paddingOf(context).top;
    final bottomH = bottom?.preferredSize.height ?? 0;
    final totalH = topPad + _toolbarH + bottomH;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: Material(
        color: AppColors.homeBgTop,
        elevation: 0,
        child: SizedBox(
          height: totalH,
          child: Column(
            children: [
              SizedBox(
                height: topPad + _toolbarH,
                child: Padding(
                  padding: EdgeInsets.only(top: topPad),
                  child: NavigationToolbar(
                    leading: leading,
                    middle: Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    trailing: actions == null
                        ? null
                        : Row(
                            mainAxisSize: MainAxisSize.min,
                            children: actions!,
                          ),
                    centerMiddle: false,
                  ),
                ),
              ),
              if (bottom != null) bottom!,
            ],
          ),
        ),
      ),
    );
  }
}

/// Nút back PlugPro — viền cam.
class PortalBackButton extends StatelessWidget {
  const PortalBackButton({super.key, this.onPressed});

  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: Insets.sm),
      child: PlugProIconButton(
        icon: LucideIcons.arrowLeft,
        onTap: onPressed ?? () => Navigator.maybePop(context),
      ),
    );
  }
}

/// Scaffold nền PlugPro + header tuỳ chọn.
class PortalPageScaffold extends StatelessWidget {
  const PortalPageScaffold({
    super.key,
    this.header,
    required this.body,
    this.floatingActionButton,
    this.backgroundColor,
  });

  final Widget? header;
  final Widget body;
  final Widget? floatingActionButton;
  final Color? backgroundColor;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: backgroundColor ?? AppColors.homeBgBottom,
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
