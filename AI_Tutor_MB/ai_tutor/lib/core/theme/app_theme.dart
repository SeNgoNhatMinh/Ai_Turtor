import 'package:flutter/material.dart';

import 'app_colors.dart';
import 'app_colors_dark.dart';
import 'app_radius.dart';
import 'app_spacing.dart';
import 'app_typography.dart';
import 'theme_extensions.dart';

ThemeData buildAppTheme() => _buildTheme(
  brightness: Brightness.light,
  canvas: AppColors.homeBgBottom,
  card: AppColors.card,
  raised: AppColors.raised,
  onSurface: AppColors.textPrimary,
  fpt: FptThemeColors.light,
);

ThemeData buildAppDarkTheme() => _buildTheme(
  brightness: Brightness.dark,
  canvas: AppColorsDark.canvas,
  card: AppColorsDark.card,
  raised: AppColorsDark.raised,
  onSurface: AppColorsDark.textPrimary,
  fpt: FptThemeColors.dark,
);

ThemeData _buildTheme({
  required Brightness brightness,
  required Color canvas,
  required Color card,
  required Color raised,
  required Color onSurface,
  required FptThemeColors fpt,
}) {
  final isDark = brightness == Brightness.dark;
  final scheme = isDark
      ? ColorScheme.dark(
          primary: AppColors.primary,
          onPrimary: AppColors.onOrange,
          secondary: AppColors.primaryTint,
          surface: card,
          error: AppColors.error,
          onSurface: onSurface,
        )
      : const ColorScheme.light(
          primary: AppColors.primary,
          onPrimary: AppColors.onOrange,
          secondary: AppColors.accent,
          onSecondary: AppColors.onOrange,
          tertiary: AppColors.primaryTint,
          surface: AppColors.card,
          error: AppColors.error,
          onSurface: AppColors.textPrimary,
        );

  final textTheme = buildTextTheme().apply(
    bodyColor: fpt.textPrimary,
    displayColor: fpt.textPrimary,
  );

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: canvas,
    extensions: [fpt],
    textTheme: textTheme,
    splashFactory: InkSparkle.splashFactory,
    appBarTheme: AppBarTheme(
      backgroundColor: canvas,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      titleSpacing: Insets.screenH,
      centerTitle: false,
      titleTextStyle: textTheme.titleLarge,
      iconTheme: IconThemeData(color: fpt.textPrimary),
    ),
    cardTheme: CardThemeData(
      color: card,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: AppColors.borderHairline),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.card,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: Insets.lg,
        vertical: Insets.md,
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(20),
        borderSide: const BorderSide(color: AppColors.borderHairline),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(20),
        borderSide: const BorderSide(color: AppColors.borderHairline),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(20),
        borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(20),
        borderSide: const BorderSide(color: AppColors.error, width: 1.5),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(20),
        borderSide: const BorderSide(color: AppColors.error, width: 1.5),
      ),
      labelStyle: textTheme.labelLarge?.copyWith(color: fpt.textSecondary),
      hintStyle: textTheme.bodyMedium?.copyWith(color: fpt.textTertiary),
      errorStyle: textTheme.bodySmall?.copyWith(color: AppColors.error),
    ),
    dividerTheme: DividerThemeData(color: fpt.borderHairline, thickness: 1),
    bottomNavigationBarTheme: BottomNavigationBarThemeData(
      backgroundColor: card,
      selectedItemColor: AppColors.primary,
      unselectedItemColor: fpt.textTertiary,
      type: BottomNavigationBarType.fixed,
      elevation: 0,
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: AppColors.primary,
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? AppColors.primary
            : fpt.textTertiary,
      ),
    ),
  );
}
