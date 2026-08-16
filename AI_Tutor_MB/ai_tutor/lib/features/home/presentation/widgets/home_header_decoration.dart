import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';

/// Nền cam + sóng đáy mảnh (xanh nhạt → xanh lá) chuyển sang nền trắng.
class HomeHeaderDecoration extends StatelessWidget {
  const HomeHeaderDecoration({super.key});

  @override
  Widget build(BuildContext context) {
    return const CustomPaint(
      painter: _HomeHeaderPainter(),
      size: Size.infinite,
    );
  }
}

class _HomeHeaderPainter extends CustomPainter {
  const _HomeHeaderPainter();

  static double _w(double x, double width, double base, double amp, double phase) {
    return base + math.sin((x / width) * math.pi * 2.5 + phase) * amp;
  }

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    // Toàn bộ nền cam
    canvas.drawRect(
      Rect.fromLTWH(0, 0, w, h),
      Paint()..color = AppColors.primary,
    );

    // Dải xanh lá nhạt — sóng đầu tiên ngay dưới cam
    _drawWaveBand(
      canvas,
      size,
      color: const Color(0xFF7CBD42),
      topFrac: 0.65,
      bottomFrac: 0.84,
      amp: h * 0.038,
      phase: 0.4,
    );

    // Dải xanh lá đậm — sóng thứ hai, mỏng hơn
    _drawWaveBand(
      canvas,
      size,
      color: const Color(0xFF56A028),
      topFrac: 0.76,
      bottomFrac: 1.0,
      amp: h * 0.03,
      phase: 1.5,
    );
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

    path.moveTo(0, _w(0, size.width, h * topFrac, amp * 0.55, phase + 0.2));
    for (var i = 1; i <= steps; i++) {
      final x = i * stepW;
      path.lineTo(x, _w(x, size.width, h * topFrac, amp * 0.55, phase + 0.2));
    }
    for (var i = steps; i >= 0; i--) {
      final x = i * stepW;
      path.lineTo(x, _w(x, size.width, h * bottomFrac, amp, phase));
    }
    path.close();
    canvas.drawPath(path, Paint()..color = color);
  }

  @override
  bool shouldRepaint(covariant CustomPainter old) => false;
}
