import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_tokens.dart';

enum FptButtonVariant { primary, secondary, accent, tonal, ghost, destructive }

enum FptButtonSize { lg, md, sm }

class FptButton extends StatefulWidget {
  const FptButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = FptButtonVariant.primary,
    this.size = FptButtonSize.lg,
    this.icon,
    this.loading = false,
    this.expand = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final FptButtonVariant variant;
  final FptButtonSize size;
  final IconData? icon;
  final bool loading;
  final bool expand;

  @override
  State<FptButton> createState() => _FptButtonState();
}

class _FptButtonState extends State<FptButton> {
  bool _down = false;

  bool get _enabled => widget.onPressed != null && !widget.loading;

  double get _height => switch (widget.size) {
    FptButtonSize.lg => 52,
    FptButtonSize.md => 44,
    FptButtonSize.sm => 36,
  };

  ({Color bg, Color pressedBg, Color fg, BoxBorder? border, bool elevated})
  _visuals() {
    if (!_enabled) {
      return (
        bg: AppColors.raised,
        pressedBg: AppColors.raised,
        fg: AppColors.textDisabled,
        border: null,
        elevated: false,
      );
    }
    return switch (widget.variant) {
      FptButtonVariant.primary => (
        bg: AppColors.primary,
        pressedBg: AppColors.primaryPressed,
        fg: AppColors.onOrange,
        border: null,
        elevated: true,
      ),
      FptButtonVariant.secondary => (
        bg: AppColors.card,
        pressedBg: AppColors.raised,
        fg: AppColors.primary,
        border: Border.all(color: AppColors.primary, width: 1.5),
        elevated: false,
      ),
      FptButtonVariant.accent => (
        bg: AppColors.accent,
        pressedBg: AppColors.accentPressed,
        fg: AppColors.onOrange,
        border: null,
        elevated: true,
      ),
      FptButtonVariant.tonal => (
        bg: AppColors.primaryWash,
        pressedBg: AppColors.sunken,
        fg: AppColors.primary,
        border: null,
        elevated: false,
      ),
      FptButtonVariant.ghost => (
        bg: Colors.transparent,
        pressedBg: AppColors.primaryWash,
        fg: AppColors.primary,
        border: Border.all(color: AppColors.primary),
        elevated: false,
      ),
      FptButtonVariant.destructive => (
        bg: AppColors.error,
        pressedBg: AppColors.error,
        fg: AppColors.onOrange,
        border: null,
        elevated: true,
      ),
    };
  }

  @override
  Widget build(BuildContext context) {
    final visuals = _visuals();
    return Semantics(
      button: true,
      enabled: _enabled,
      label: widget.label,
      child: GestureDetector(
        onTapDown: _enabled
            ? (_) {
                setState(() => _down = true);
                HapticFeedback.selectionClick();
              }
            : null,
        onTapUp: _enabled ? (_) => setState(() => _down = false) : null,
        onTapCancel: () => setState(() => _down = false),
        onTap: _enabled ? widget.onPressed : null,
        child: AnimatedScale(
          scale: _down ? 0.97 : 1,
          duration: Motion.fast,
          curve: Curves.easeOut,
          child: AnimatedContainer(
            duration: Motion.fast,
            height: _height,
            width: widget.expand ? double.infinity : null,
            padding: const EdgeInsets.symmetric(horizontal: Insets.xl),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: _down ? visuals.pressedBg : visuals.bg,
              borderRadius: BorderRadius.circular(20),
              border: visuals.border,
              boxShadow: visuals.elevated ? Shadows.md : null,
            ),
            child: Row(
              mainAxisSize: widget.expand ? MainAxisSize.max : MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (widget.loading)
                  SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: visuals.fg,
                    ),
                  )
                else ...[
                  if (widget.icon != null) ...[
                    Icon(widget.icon, size: 18, color: visuals.fg),
                    const SizedBox(width: Insets.sm),
                  ],
                  Text(
                    widget.label,
                    style: Theme.of(
                      context,
                    ).textTheme.labelLarge?.copyWith(color: visuals.fg),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
