import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';

TextTheme buildTextTheme() {
  final base = GoogleFonts.interTextTheme();
  return base.copyWith(
    displayLarge: GoogleFonts.inter(
      fontSize: 32,
      height: 1.25,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.5,
      color: AppColors.textPrimary,
    ),
    headlineMedium: GoogleFonts.inter(
      fontSize: 28,
      height: 1.29,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.4,
      color: AppColors.textPrimary,
    ),
    titleLarge: GoogleFonts.inter(
      fontSize: 22,
      height: 1.36,
      fontWeight: FontWeight.w600,
      color: AppColors.textPrimary,
    ),
    titleMedium: GoogleFonts.inter(
      fontSize: 18,
      height: 1.44,
      fontWeight: FontWeight.w600,
      color: AppColors.textPrimary,
    ),
    bodyLarge: GoogleFonts.inter(
      fontSize: 16,
      height: 1.5,
      fontWeight: FontWeight.w400,
      color: AppColors.textPrimary,
    ),
    bodyMedium: GoogleFonts.inter(
      fontSize: 15,
      height: 1.47,
      fontWeight: FontWeight.w400,
      color: AppColors.textSecondary,
    ),
    labelLarge: GoogleFonts.inter(
      fontSize: 14,
      height: 1.43,
      fontWeight: FontWeight.w500,
      color: AppColors.textPrimary,
    ),
    bodySmall: GoogleFonts.inter(
      fontSize: 13,
      height: 1.38,
      fontWeight: FontWeight.w400,
      color: AppColors.textTertiary,
    ),
  );
}

TextStyle statStyle() => GoogleFonts.inter(
  fontSize: 28,
  height: 1.14,
  fontWeight: FontWeight.w600,
  letterSpacing: -0.5,
  color: AppColors.textPrimary,
);

TextStyle codeStyle() => GoogleFonts.jetBrainsMono(
  fontSize: 14,
  height: 1.5,
  color: AppColors.textPrimary,
);
