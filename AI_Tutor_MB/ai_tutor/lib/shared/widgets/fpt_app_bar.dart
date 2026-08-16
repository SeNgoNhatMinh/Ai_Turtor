import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import 'portal/portal_subpage_header.dart';

class FptAppBar extends StatelessWidget implements PreferredSizeWidget {
  const FptAppBar({
    super.key,
    required this.title,
    this.actions,
    this.leading,
    this.bottom,
    this.automaticallyImplyLeading = true,
  });

  final String title;
  final List<Widget>? actions;
  final Widget? leading;
  final PreferredSizeWidget? bottom;
  final bool automaticallyImplyLeading;

  @override
  Size get preferredSize => PortalSubpageHeader(
    title: title,
    bottom: bottom,
  ).preferredSize;

  @override
  Widget build(BuildContext context) {
    Widget? resolvedLeading = leading;
    if (resolvedLeading == null &&
        automaticallyImplyLeading &&
        context.canPop()) {
      resolvedLeading = PortalBackButton(onPressed: () => context.pop());
    }

    final resolvedActions = actions?.map((action) {
      if (action is IconButton) {
        return IconButton(
          icon: IconTheme.merge(
            data: const IconThemeData(color: AppColors.primary),
            child: action.icon,
          ),
          onPressed: action.onPressed,
          tooltip: action.tooltip,
        );
      }
      return action;
    }).toList();

    return PortalSubpageHeader(
      title: title,
      leading: resolvedLeading,
      actions: resolvedActions,
      bottom: bottom,
    );
  }
}
