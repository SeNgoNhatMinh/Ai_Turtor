import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_tokens.dart';
import '../../core/utils/vietnamese_text_input.dart';

class FptTextField extends StatefulWidget {
  const FptTextField({
    super.key,
    this.controller,
    this.label,
    this.hint,
    this.errorText,
    this.obscureText = false,
    this.keyboardType,
    this.textInputAction,
    this.onChanged,
    this.onSubmitted,
    this.prefixIcon,
    this.suffixIcon,
    this.maxLines = 1,
    this.enabled = true,
    this.autofillHints,
    this.enableInteractiveSelection = true,
    this.vietnameseInput = true,
  });

  final TextEditingController? controller;
  final String? label;
  final String? hint;
  final String? errorText;
  final bool obscureText;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final Widget? prefixIcon;
  final Widget? suffixIcon;
  final int maxLines;
  final bool enabled;
  final Iterable<String>? autofillHints;
  final bool enableInteractiveSelection;

  /// When true (default), use OS Vietnamese IME — no Telex formatters.
  /// Set false for code / ID fields.
  final bool vietnameseInput;

  @override
  State<FptTextField> createState() => _FptTextFieldState();
}

class _FptTextFieldState extends State<FptTextField> {
  late final FocusNode _focusNode;
  bool _focused = false;

  @override
  void initState() {
    super.initState();
    _focusNode = FocusNode()..addListener(_onFocusChange);
  }

  void _onFocusChange() {
    setState(() => _focused = _focusNode.hasFocus);
  }

  @override
  void dispose() {
    _focusNode
      ..removeListener(_onFocusChange)
      ..dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hasError = widget.errorText != null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.label != null) ...[
          Text(
            widget.label!,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: hasError ? AppColors.error : AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: Insets.sm),
        ],
        AnimatedContainer(
          duration: Motion.fast,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(Radii.md),
            boxShadow: _focused && !hasError ? Shadows.md : null,
          ),
          child: TextField(
            controller: widget.controller,
            focusNode: _focusNode,
            enabled: widget.enabled,
            obscureText: widget.obscureText,
            keyboardType: widget.keyboardType ??
                VietnameseTextInput.keyboardForMultiline(widget.maxLines),
            textInputAction: widget.textInputAction,
            onChanged: widget.onChanged,
            onSubmitted: widget.onSubmitted,
            maxLines: widget.maxLines,
            autofillHints: widget.autofillHints,
            enableInteractiveSelection: widget.enableInteractiveSelection,
            autocorrect: widget.vietnameseInput && !widget.obscureText,
            enableIMEPersonalizedLearning: widget.vietnameseInput &&
                !widget.obscureText,
            enableSuggestions: widget.vietnameseInput && !widget.obscureText,
            textCapitalization: widget.vietnameseInput && widget.maxLines == 1
                ? VietnameseTextInput.textCapitalization
                : TextCapitalization.none,
            smartDashesType: VietnameseTextInput.smartDashesType,
            smartQuotesType: VietnameseTextInput.smartQuotesType,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w700,
              fontSize: 16,
            ),
            decoration: InputDecoration(
              hintText: widget.hint,
              errorText: widget.errorText,
              prefixIcon: widget.prefixIcon,
              suffixIcon: widget.suffixIcon,
              fillColor: _focused ? AppColors.card : AppColors.raised,
              hintStyle: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: AppColors.textTertiary,
                fontWeight: FontWeight.w400,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class FptBottomNavItem {
  const FptBottomNavItem({
    required this.label,
    required this.icon,
    required this.activeIcon,
    this.imageAsset,
    this.badgeCount,
  });

  final String label;
  final IconData icon;
  final IconData activeIcon;

  /// Nếu có, render ảnh asset này thay cho [icon]/[activeIcon] (vd logo linh vật).
  final String? imageAsset;
  final int? badgeCount;
}

class FptBottomNav extends StatelessWidget {
  const FptBottomNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
    required this.items,
  });

  final int currentIndex;
  final ValueChanged<int> onTap;
  final List<FptBottomNavItem> items;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: AppColors.navBarBg,
        boxShadow: [
          BoxShadow(
            color: Color(0x12000000),
            blurRadius: 12,
            offset: Offset(0, -3),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 64,
          child: Row(
            children: [
              for (var i = 0; i < items.length; i++)
                Expanded(
                  child: _NavItem(
                    item: items[i],
                    selected: i == currentIndex,
                    onTap: () {
                      if (i != currentIndex) {
                        HapticFeedback.selectionClick();
                        onTap(i);
                      }
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.item,
    required this.selected,
    required this.onTap,
  });

  final FptBottomNavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? AppColors.navActive : AppColors.navInactive;
    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      child: InkWell(
        onTap: onTap,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AnimatedContainer(
              duration: Motion.base,
              curve: Curves.easeOutCubic,
              padding: const EdgeInsets.symmetric(
                horizontal: Insets.md,
                vertical: Insets.xs,
              ),
              decoration: BoxDecoration(
                color: selected
                    ? AppColors.primaryWash.withValues(alpha: 0.6)
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(Radii.full),
              ),
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  if (item.imageAsset != null)
                    Opacity(
                      opacity: selected ? 1 : 0.55,
                      child: Image.asset(
                        item.imageAsset!,
                        width: 24,
                        height: 24,
                        fit: BoxFit.contain,
                        // Chưa có file logo → tạm hiển thị icon mặc định.
                        errorBuilder: (_, __, ___) => Icon(
                          selected ? item.activeIcon : item.icon,
                          size: 22,
                          color: color,
                        ),
                      ),
                    )
                  else
                    Icon(
                      selected ? item.activeIcon : item.icon,
                      size: 22,
                      color: color,
                    ),
                  if (item.badgeCount != null && item.badgeCount! > 0)
                    Positioned(
                      right: -6,
                      top: -4,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 5,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.error,
                          borderRadius: BorderRadius.circular(Radii.full),
                        ),
                        constraints: const BoxConstraints(minWidth: 16),
                        child: Text(
                          item.badgeCount! > 99
                              ? '99+'
                              : item.badgeCount.toString(),
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(
                                color: AppColors.onOrange,
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: Insets.xs),
            AnimatedDefaultTextStyle(
              duration: Motion.base,
              curve: Curves.easeOutCubic,
              style: Theme.of(context).textTheme.bodySmall!.copyWith(
                color: color,
                fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
              ),
              child: Text(item.label),
            ),
          ],
        ),
      ),
    );
  }
}
