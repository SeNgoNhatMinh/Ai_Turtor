import 'package:flutter/material.dart';

import 'app_colors.dart';
import 'app_colors_dark.dart';

@immutable
class FptThemeColors extends ThemeExtension<FptThemeColors> {
  const FptThemeColors({
    required this.canvas,
    required this.card,
    required this.raised,
    required this.sunken,
    required this.textPrimary,
    required this.textSecondary,
    required this.textTertiary,
    required this.borderHairline,
    required this.borderStrong,
    required this.primaryWash,
    required this.warm100,
  });

  final Color canvas;
  final Color card;
  final Color raised;
  final Color sunken;
  final Color textPrimary;
  final Color textSecondary;
  final Color textTertiary;
  final Color borderHairline;
  final Color borderStrong;
  final Color primaryWash;
  final Color warm100;

  static const light = FptThemeColors(
    canvas: AppColors.canvas,
    card: AppColors.card,
    raised: AppColors.raised,
    sunken: AppColors.sunken,
    textPrimary: AppColors.textPrimary,
    textSecondary: AppColors.textSecondary,
    textTertiary: AppColors.textTertiary,
    borderHairline: AppColors.borderHairline,
    borderStrong: AppColors.borderStrong,
    primaryWash: AppColors.primaryWash,
    warm100: AppColors.warm100,
  );

  static const dark = FptThemeColors(
    canvas: AppColorsDark.canvas,
    card: AppColorsDark.card,
    raised: AppColorsDark.raised,
    sunken: AppColorsDark.sunken,
    textPrimary: AppColorsDark.textPrimary,
    textSecondary: AppColorsDark.textSecondary,
    textTertiary: AppColorsDark.textTertiary,
    borderHairline: AppColorsDark.borderHairline,
    borderStrong: AppColorsDark.borderStrong,
    primaryWash: AppColorsDark.primaryWash,
    warm100: AppColorsDark.warm100,
  );

  @override
  FptThemeColors copyWith({
    Color? canvas,
    Color? card,
    Color? raised,
    Color? sunken,
    Color? textPrimary,
    Color? textSecondary,
    Color? textTertiary,
    Color? borderHairline,
    Color? borderStrong,
    Color? primaryWash,
    Color? warm100,
  }) {
    return FptThemeColors(
      canvas: canvas ?? this.canvas,
      card: card ?? this.card,
      raised: raised ?? this.raised,
      sunken: sunken ?? this.sunken,
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      textTertiary: textTertiary ?? this.textTertiary,
      borderHairline: borderHairline ?? this.borderHairline,
      borderStrong: borderStrong ?? this.borderStrong,
      primaryWash: primaryWash ?? this.primaryWash,
      warm100: warm100 ?? this.warm100,
    );
  }

  @override
  FptThemeColors lerp(ThemeExtension<FptThemeColors>? other, double t) {
    if (other is! FptThemeColors) return this;
    return FptThemeColors(
      canvas: Color.lerp(canvas, other.canvas, t)!,
      card: Color.lerp(card, other.card, t)!,
      raised: Color.lerp(raised, other.raised, t)!,
      sunken: Color.lerp(sunken, other.sunken, t)!,
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      textTertiary: Color.lerp(textTertiary, other.textTertiary, t)!,
      borderHairline: Color.lerp(borderHairline, other.borderHairline, t)!,
      borderStrong: Color.lerp(borderStrong, other.borderStrong, t)!,
      primaryWash: Color.lerp(primaryWash, other.primaryWash, t)!,
      warm100: Color.lerp(warm100, other.warm100, t)!,
    );
  }
}

extension FptThemeContext on BuildContext {
  FptThemeColors get fpt =>
      Theme.of(this).extension<FptThemeColors>() ?? FptThemeColors.light;
}
