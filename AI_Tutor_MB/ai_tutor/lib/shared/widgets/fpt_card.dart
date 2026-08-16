import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_tokens.dart';
import '../../core/theme/theme_extensions.dart';

class FptCard extends StatefulWidget {
  const FptCard({
    super.key,
    required this.child,
    this.onTap,
    this.outlined = false,
    this.padding,
  });

  final Widget child;
  final VoidCallback? onTap;
  final bool outlined;
  final EdgeInsets? padding;

  @override
  State<FptCard> createState() => _FptCardState();
}

class _FptCardState extends State<FptCard> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final fpt = context.fpt;
    final card = AnimatedScale(
      scale: _down ? 0.99 : 1,
      duration: Motion.fast,
      curve: Curves.easeOut,
      child: Container(
        padding: widget.padding ?? const EdgeInsets.all(Insets.lg),
        decoration: BoxDecoration(
          color: widget.outlined ? fpt.canvas : fpt.card,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: widget.outlined
                ? AppColors.homeOrangeWash
                : AppColors.homeOrangeWash,
          ),
          boxShadow: widget.outlined ? null : Shadows.md,
        ),
        child: widget.child,
      ),
    );

    if (widget.onTap == null) return card;

    return GestureDetector(
      onTapDown: (_) => setState(() => _down = true),
      onTapUp: (_) => setState(() => _down = false),
      onTapCancel: () => setState(() => _down = false),
      onTap: widget.onTap,
      child: card,
    );
  }
}
