import 'package:flutter/material.dart';

/// EduNova-inspired brand tokens — KHÔNG hard-code hex ngoài file này.
abstract final class AppColors {
  // Primary (navy)
  static const primary = Color(0xFF0D1B3D);
  static const primaryPressed = Color(0xFF0A152E);
  static const primaryDark = Color(0xFF070F24);
  static const primaryTint = Color(0xFF1E3A8A);
  static const primaryWash = Color(0xFFE8EEF7);

  // Accent (orange — CTA phụ, FAB, đăng ký)
  static const accent = Color(0xFFFF8A00);
  static const accentPressed = Color(0xFFE67A00);
  static const accentDark = Color(0xFFCC6D00);
  static const accentWash = Color(0xFFFFF3E0);

  // Secondary aliases (giữ tên cũ cho tương thích)
  static const leafGreen = Color(0xFF22C55E);
  static const peacockBlue = primaryTint;

  // Surfaces
  static const canvas = Color(0xFFF8FAFC);
  static const card = Color(0xFFFFFFFF);
  static const raised = Color(0xFFF1F5F9);
  static const sunken = Color(0xFFE2E8F0);
  static const inverse = Color(0xFF0D1B3D);

  // Borders
  static const borderHairline = Color(0xFFE5E7EB);
  static const borderStrong = Color(0xFFCBD5E1);

  // Text
  static const textPrimary = Color(0xFF0F172A);
  static const textSecondary = Color(0xFF64748B);
  static const textTertiary = Color(0xFF94A3B8);
  static const textDisabled = Color(0xFFCBD5E1);
  static const onOrange = Color(0xFFFFFFFF);

  // Semantic
  static const success = Color(0xFF16A34A);
  static const successBg = Color(0xFFDCFCE7);
  static const warning = Color(0xFFEAB308);
  static const warningBg = Color(0xFFFEF9C3);
  static const error = Color(0xFFDC2626);
  static const errorBg = Color(0xFFFEE2E2);
  static const info = Color(0xFF2563EB);
  static const infoBg = Color(0xFFDBEAFE);

  // Neutral
  static const warm100 = Color(0xFFF1F5F9);
  static const warm300 = Color(0xFFCBD5E1);
  static const warm500 = Color(0xFF64748B);
  static const warm700 = Color(0xFF334155);

  static const scrim = Color(0xA60D1B3D);
  static const focusRing = Color(0xFF1E3A8A);

  // Splash / auth illustration
  static const splashSky = Color(0xFF60A5FA);
  static const splashGold = accent;
  static const splashHillGreen = leafGreen;
  static const splashWaveLight = Color(0xFF3B82F6);
  static const splashWaveDark = primaryTint;
  static const splashNavy = primary;
  static const authScreenBg = Color(0xFFF8FAFC);

  static const brandGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [primary, primaryTint],
  );

  // Home — nền sáng, hero navy
  static const homeBgTop = Color(0xFFF8FAFC);
  static const homeBgBottom = Color(0xFFFFFFFF);
  static const homeOrangeBright = Color(0xFF93C5FD);
  static const homeOrangeMid = primaryTint;
  static const homeOrangeDeep = primary;
  static const homeOrangeWash = borderHairline;
  static const homeHeroGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [primary, primaryTint],
  );
  static const homeScreenGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [homeBgTop, homeBgBottom],
    stops: [0.0, 1.0],
  );

  // Bottom navigation
  static const navActive = primary;
  static const navInactive = textTertiary;
  static const navBarBg = card;
}
