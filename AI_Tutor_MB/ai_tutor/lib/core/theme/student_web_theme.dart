import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Visual bridge that mirrors the student workspace on the web client.
///
/// It is applied only by [StudentShell], so teacher/admin workspaces keep their
/// existing visual system.
ThemeData buildStudentWebTheme(ThemeData base) {
  final isDark = base.brightness == Brightness.dark;
  final canvas = isDark ? const Color(0xFF000000) : AppColors.studentCanvas;
  final surface = isDark ? const Color(0xFF171717) : AppColors.studentSurface;
  final border = isDark ? const Color(0xFF2F2F2F) : AppColors.studentBorder;
  final text = isDark ? const Color(0xFFF9FAFB) : AppColors.studentText;
  final muted = isDark ? const Color(0xFFA3A3A3) : AppColors.studentMuted;

  final scheme = base.colorScheme.copyWith(
    primary: AppColors.studentBlue,
    onPrimary: Colors.white,
    secondary: AppColors.fptOrange,
    onSecondary: Colors.white,
    surface: surface,
    onSurface: text,
    outline: border,
  );
  final textTheme = base.textTheme.apply(
    bodyColor: text,
    displayColor: text,
  );

  return base.copyWith(
    scaffoldBackgroundColor: canvas,
    colorScheme: scheme,
    textTheme: textTheme,
    appBarTheme: base.appBarTheme.copyWith(
      backgroundColor: surface,
      foregroundColor: text,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
    ),
    cardTheme: base.cardTheme.copyWith(
      color: surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: border),
      ),
    ),
    inputDecorationTheme: base.inputDecorationTheme.copyWith(
      filled: true,
      fillColor: surface,
      hintStyle: base.textTheme.bodyMedium?.copyWith(color: muted),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(13),
        borderSide: BorderSide(color: border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(13),
        borderSide: BorderSide(color: border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(13),
        borderSide: const BorderSide(color: AppColors.studentBlue, width: 1.5),
      ),
    ),
    tabBarTheme: base.tabBarTheme.copyWith(
      labelColor: AppColors.studentBlue,
      unselectedLabelColor: muted,
      indicatorColor: AppColors.studentBlue,
      dividerColor: border,
    ),
    dividerTheme: DividerThemeData(color: border, thickness: 1),
    navigationBarTheme: base.navigationBarTheme.copyWith(
      backgroundColor: surface,
      indicatorColor: isDark
          ? const Color(0xFF233A56)
          : const Color(0xFFEAF4FF),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => base.textTheme.labelSmall?.copyWith(
          color: states.contains(WidgetState.selected)
              ? AppColors.studentBlue
              : muted,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w700
              : FontWeight.w500,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          color: states.contains(WidgetState.selected)
              ? AppColors.studentBlue
              : muted,
        ),
      ),
    ),
  );
}
