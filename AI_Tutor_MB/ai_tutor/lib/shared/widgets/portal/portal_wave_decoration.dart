import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';

/// Sóng cam + xanh — dùng chung header tab & sub-page (khớp splash).
class PortalWaveDecoration extends StatelessWidget {
  const PortalWaveDecoration({
    super.key,
    this.variant = PortalWaveVariant.compact,
  });

  final PortalWaveVariant variant;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _PortalWavePainter(variant: variant),
      size: Size.infinite,
    );
  }
}

enum PortalWaveVariant { compact, profile, subpage }

class _PortalWavePainter extends CustomPainter {
  const _PortalWavePainter({required this.variant});

  final PortalWaveVariant variant;

  static double _wave(
    double x,
    double width,
    double base,
    double amp,
    double phase,
  ) {
    return base + math.sin((x / width) * math.pi * 2.5 + phase) * amp;
  }

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    canvas.drawRect(
      Rect.fromLTWH(0, 0, w, h),
      Paint()..color = AppColors.primary,
    );

    if (variant == PortalWaveVariant.profile) {
      _drawProfileWaves(canvas, size);
      return;
    }

    final topFrac = variant == PortalWaveVariant.subpage ? 0.72 : 0.65;
    final bottomFrac = variant == PortalWaveVariant.subpage ? 0.92 : 0.84;

    _drawWaveBand(
      canvas,
      size,
      color: AppColors.splashWaveLight,
      topFrac: topFrac,
      bottomFrac: bottomFrac,
      amp: h * 0.038,
      phase: 0.4,
    );

    _drawWaveBand(
      canvas,
      size,
      color: AppColors.splashWaveDark,
      topFrac: topFrac + 0.11,
      bottomFrac: 1.0,
      amp: h * 0.03,
      phase: 1.5,
    );
  }

  void _drawProfileWaves(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    final waveBlue = Path()
      ..moveTo(0, h * 0.66)
      ..quadraticBezierTo(w * 0.45, h * 0.71, w * 0.7, h * 0.67)
      ..quadraticBezierTo(w * 0.92, h * 0.64, w, h * 0.68)
      ..lineTo(w, h * 0.74)
      ..quadraticBezierTo(w * 0.55, h * 0.78, w * 0.25, h * 0.73)
      ..lineTo(0, h * 0.72)
      ..close();
    canvas.drawPath(
      waveBlue,
      Paint()..color = AppColors.peacockBlue.withValues(alpha: 0.55),
    );

    final wave1 = Path()
      ..moveTo(0, h * 0.72)
      ..quadraticBezierTo(w * 0.35, h * 0.82, w * 0.55, h * 0.74)
      ..quadraticBezierTo(w * 0.8, h * 0.66, w, h * 0.76)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();
    canvas.drawPath(wave1, Paint()..color = AppColors.splashWaveLight);

    final wave2 = Path()
      ..moveTo(0, h * 0.8)
      ..quadraticBezierTo(w * 0.5, h * 0.92, w, h * 0.84)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();
    canvas.drawPath(wave2, Paint()..color = AppColors.authScreenBg);
  }

  void _drawWaveBand(
    Canvas canvas,
    Size size, {
    required Color color,
    required double topFrac,
    required double bottomFrac,
    required double amp,
    required double phase,
  }) {
    final h = size.height;
    const steps = 30;
    final stepW = size.width / steps;
    final path = Path();

    path.moveTo(0, _wave(0, size.width, h * topFrac, amp * 0.55, phase + 0.2));
    for (var i = 1; i <= steps; i++) {
      final x = i * stepW;
      path.lineTo(x, _wave(x, size.width, h * topFrac, amp * 0.55, phase + 0.2));
    }
    for (var i = steps; i >= 0; i--) {
      final x = i * stepW;
      path.lineTo(x, _wave(x, size.width, h * bottomFrac, amp, phase));
    }
    path.close();
    canvas.drawPath(path, Paint()..color = color);
  }

  @override
  bool shouldRepaint(covariant _PortalWavePainter oldDelegate) =>
      oldDelegate.variant != variant;
}
