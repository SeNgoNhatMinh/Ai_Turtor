import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';

/// Dải sóng ngang phía trên — xanh lá → vàng → xanh nhạt → navy → cam.
class SplashTopDecoration extends StatelessWidget {
  const SplashTopDecoration({
    super.key,
    this.height,
    this.bottomWhiteTrim = 0,
  });

  /// Chiều cao tuỳ chỉnh (vd. header login). Mặc định 36% màn hình.
  final double? height;

  /// Cắt bớt đáy sóng cam, thay bằng trắng (0–0.2). VD: 0.12 ≈ cắt ~12% chiều cao.
  final double bottomWhiteTrim;

  @override
  Widget build(BuildContext context) {
    final height = this.height ?? MediaQuery.sizeOf(context).height * 0.36;
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      height: height,
      child: CustomPaint(
        painter: _SplashTopPainter(bottomWhiteTrim: bottomWhiteTrim),
        size: Size.infinite,
      ),
    );
  }
}

class _SplashTopPainter extends CustomPainter {
  const _SplashTopPainter({this.bottomWhiteTrim = 0});

  final double bottomWhiteTrim;

  static double _wave(
    double x,
    double w,
    double base,
    double amp,
    double phase,
  ) {
    return base + math.sin((x / w) * math.pi * 2.2 + phase) * amp;
  }

  @override
  void paint(Canvas canvas, Size size) {
    final h = size.height;
    final trim = bottomWhiteTrim.clamp(0.0, 0.2);
    final orangeBottom = 0.98 - trim;

    final bands =
        <
          ({
            Color color,
            double topBase,
            double bottomBase,
            double amp,
            double phase,
          })
        >[
          (
            color: AppColors.splashHillGreen,
            topBase: 0,
            bottomBase: 0.14,
            amp: 0.035,
            phase: 0,
          ),
          (
            color: AppColors.splashGold,
            topBase: 0.12,
            bottomBase: 0.26,
            amp: 0.04,
            phase: 0.8,
          ),
          (
            color: AppColors.splashSky,
            topBase: 0.24,
            bottomBase: 0.40,
            amp: 0.045,
            phase: 1.6,
          ),
          (
            color: AppColors.peacockBlue,
            topBase: 0.38,
            bottomBase: 0.56,
            amp: 0.05,
            phase: 2.4,
          ),
          (
            color: AppColors.primary,
            topBase: 0.54,
            bottomBase: orangeBottom,
            amp: 0.04,
            phase: 3.2,
          ),
        ];

    for (final band in bands) {
      _drawBand(
        canvas,
        size,
        color: band.color,
        topBase: band.topBase * h,
        bottomBase: band.bottomBase * h,
        amp: band.amp * h,
        phase: band.phase,
      );
    }

    if (trim > 0) {
      _drawBand(
        canvas,
        size,
        color: AppColors.card,
        topBase: (orangeBottom - 0.03) * h,
        bottomBase: h,
        amp: 0.03 * h,
        phase: 3.5,
      );
    }
  }

  void _drawBand(
    Canvas canvas,
    Size size, {
    required Color color,
    required double topBase,
    required double bottomBase,
    required double amp,
    required double phase,
  }) {
    const steps = 24;
    final stepW = size.width / steps;
    final path = Path();

    path.moveTo(0, _wave(0, size.width, topBase, amp * 0.6, phase + 0.3));
    for (var i = 1; i <= steps; i++) {
      final x = i * stepW;
      path.lineTo(x, _wave(x, size.width, topBase, amp * 0.6, phase + 0.3));
    }
    for (var i = steps; i >= 0; i--) {
      final x = i * stepW;
      path.lineTo(x, _wave(x, size.width, bottomBase, amp, phase));
    }
    path.close();
    canvas.drawPath(path, Paint()..color = color);
  }

  @override
  bool shouldRepaint(covariant _SplashTopPainter oldDelegate) =>
      oldDelegate.bottomWhiteTrim != bottomWhiteTrim;
}

/// Icon trắng mờ trên vùng sóng cam phía trên.
class SplashTopOverlayIcons extends StatelessWidget {
  const SplashTopOverlayIcons({super.key, this.topHeight});

  /// Khớp chiều cao với [SplashTopDecoration].
  final double? topHeight;

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final topH = topHeight ?? size.height * 0.36;
    const c = AppColors.onOrange;

    Widget icon(IconData data, double rx, double ry, {double s = 22}) {
      return Positioned(
        left: size.width * rx,
        top: topH * ry,
        child: Icon(data, size: s, color: c.withValues(alpha: 0.45)),
      );
    }

    return IgnorePointer(
      child: Stack(
        children: [
          Positioned(
            left: size.width * 0.05,
            top: topH * 0.08,
            child: CustomPaint(
              size: const Size(52, 44),
              painter: _ConstellationPainter(color: c.withValues(alpha: 0.4)),
            ),
          ),
          icon(LucideIcons.graduationCap, 0.12, 0.52, s: 28),
          icon(LucideIcons.pencil, 0.20, 0.62, s: 22),
          icon(LucideIcons.globe2, 0.74, 0.55, s: 28),
          icon(LucideIcons.grid, 0.82, 0.18, s: 20),
        ],
      ),
    );
  }
}

/// Họa tiết pastel mờ ở vùng trắng giữa màn.
class SplashMidDecorations extends StatelessWidget {
  const SplashMidDecorations({super.key});

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);

    return IgnorePointer(
      child: Stack(
        children: [
          Positioned(
            left: size.width * 0.08,
            top: size.height * 0.46,
            child: Icon(
              LucideIcons.bookOpen,
              size: 26,
              color: AppColors.splashSky.withValues(alpha: 0.35),
            ),
          ),
          Positioned(
            left: size.width * 0.84,
            top: size.height * 0.50,
            child: CustomPaint(
              size: const Size(26, 26),
              painter: _DashedSquarePainter(
                color: AppColors.splashSky.withValues(alpha: 0.35),
              ),
            ),
          ),
          _dot(size, 0.18, 0.54, AppColors.primary),
          _dot(size, 0.88, 0.44, AppColors.splashSky),
          _star(size, 0.24, 0.42, AppColors.splashHillGreen),
          _star(size, 0.76, 0.48, AppColors.splashGold),
          _star(size, 0.62, 0.58, AppColors.splashSky),
          _diamond(size, 0.14, 0.62, AppColors.splashGold),
          _diamond(size, 0.90, 0.56, AppColors.primary),
        ],
      ),
    );
  }

  Widget _dot(Size size, double rx, double ry, Color color) {
    return Positioned(
      left: size.width * rx,
      top: size.height * ry,
      child: Container(
        width: 8,
        height: 8,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: color.withValues(alpha: 0.4),
        ),
      ),
    );
  }

  Widget _star(Size size, double rx, double ry, Color color) {
    return Positioned(
      left: size.width * rx,
      top: size.height * ry,
      child: CustomPaint(
        size: const Size(14, 14),
        painter: _FourPointStarPainter(color: color.withValues(alpha: 0.45)),
      ),
    );
  }

  Widget _diamond(Size size, double rx, double ry, Color color) {
    return Positioned(
      left: size.width * rx,
      top: size.height * ry,
      child: Transform.rotate(
        angle: math.pi / 4,
        child: Container(
          width: 8,
          height: 8,
          color: color.withValues(alpha: 0.4),
        ),
      ),
    );
  }
}

/// Phong cảnh đồi + mây + cây + tòa nhà cổ điển phía dưới.
class SplashBottomLandscape extends StatelessWidget {
  const SplashBottomLandscape({super.key});

  @override
  Widget build(BuildContext context) {
    final height = MediaQuery.sizeOf(context).height * 0.30;
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      height: height,
      child: CustomPaint(
        painter: const _SplashBottomPainter(),
        size: Size.infinite,
      ),
    );
  }
}

class _SplashBottomPainter extends CustomPainter {
  const _SplashBottomPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    _drawHill(canvas, size, AppColors.splashHillGreen, h * 0.38, h * 0.08, 0);
    _drawHill(canvas, size, AppColors.splashGold, h * 0.50, h * 0.10, 1.2);
    _drawHill(canvas, size, AppColors.splashSky, h * 0.68, h * 0.07, 2.0);

    _drawCloud(canvas, Offset(w * 0.22, h * 0.22), w * 0.16);
    _drawCloud(canvas, Offset(w * 0.50, h * 0.16), w * 0.20);
    _drawCloud(canvas, Offset(w * 0.76, h * 0.20), w * 0.14);

    _drawTree(canvas, Offset(w * 0.06, h * 0.48), AppColors.primary);
    _drawTree(canvas, Offset(w * 0.14, h * 0.56), AppColors.splashGold);
    _drawTree(canvas, Offset(w * 0.22, h * 0.50), AppColors.splashHillGreen);
    _drawTree(canvas, Offset(w * 0.78, h * 0.48), AppColors.splashSky);
    _drawTree(canvas, Offset(w * 0.86, h * 0.56), AppColors.primary);
    _drawTree(canvas, Offset(w * 0.94, h * 0.52), AppColors.splashHillGreen);

    _drawUniversity(canvas, Offset(w * 0.5, h * 0.62), w * 0.34);
  }

  void _drawHill(
    Canvas canvas,
    Size size,
    Color color,
    double baseY,
    double amplitude,
    double phase,
  ) {
    final path = Path()..moveTo(0, size.height);
    const segments = 10;
    final segW = size.width / segments;

    for (var i = 0; i <= segments; i++) {
      final x = i * segW;
      final y = baseY + math.sin(i * 0.7 + phase) * amplitude;
      if (i == 0) {
        path.lineTo(x, y);
      } else {
        final prevX = (i - 1) * segW;
        final prevY = baseY + math.sin((i - 1) * 0.7 + phase) * amplitude;
        path.cubicTo(prevX + segW * 0.5, prevY, x - segW * 0.5, y, x, y);
      }
    }
    path
      ..lineTo(size.width, size.height)
      ..close();
    canvas.drawPath(path, Paint()..color = color);
  }

  void _drawCloud(Canvas canvas, Offset center, double width) {
    final paint = Paint()..color = AppColors.card.withValues(alpha: 0.95);
    canvas.drawOval(
      Rect.fromCenter(center: center, width: width, height: width * 0.38),
      paint,
    );
    canvas.drawOval(
      Rect.fromCenter(
        center: center.translate(-width * 0.30, width * 0.02),
        width: width * 0.52,
        height: width * 0.30,
      ),
      paint,
    );
    canvas.drawOval(
      Rect.fromCenter(
        center: center.translate(width * 0.28, width * 0.04),
        width: width * 0.46,
        height: width * 0.28,
      ),
      paint,
    );
  }

  void _drawTree(Canvas canvas, Offset base, Color foliage) {
    final trunk = Paint()..color = AppColors.warm700;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(center: base.translate(0, 10), width: 7, height: 22),
        const Radius.circular(3),
      ),
      trunk,
    );
    canvas.drawCircle(base.translate(0, -10), 16, Paint()..color = foliage);
    canvas.drawCircle(
      base.translate(-12, 0),
      11,
      Paint()..color = foliage.withValues(alpha: 0.88),
    );
    canvas.drawCircle(
      base.translate(12, 0),
      11,
      Paint()..color = foliage.withValues(alpha: 0.88),
    );
  }

  void _drawUniversity(Canvas canvas, Offset center, double width) {
    final bodyW = width;
    final bodyH = width * 0.42;
    final bodyLeft = center.dx - bodyW / 2;
    final bodyTop = center.dy - bodyH * 0.15;
    final pedimentH = bodyH * 0.35;

    // Bậc thềm
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(
          bodyLeft - 6,
          bodyTop + bodyH * 0.88,
          bodyW + 12,
          bodyH * 0.14,
        ),
        const Radius.circular(2),
      ),
      Paint()..color = AppColors.raised,
    );

    // Thân tòa nhà
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(bodyLeft, bodyTop, bodyW, bodyH),
        const Radius.circular(2),
      ),
      Paint()..color = AppColors.card,
    );

    // Mái tam giác (pediment)
    final pedTop = bodyTop - pedimentH;
    canvas.drawPath(
      Path()
        ..moveTo(bodyLeft - 10, bodyTop)
        ..lineTo(center.dx, pedTop)
        ..lineTo(bodyLeft + bodyW + 10, bodyTop)
        ..close(),
      Paint()..color = AppColors.card,
    );
    canvas.drawLine(
      Offset(bodyLeft - 10, bodyTop),
      Offset(bodyLeft + bodyW + 10, bodyTop),
      Paint()
        ..color = AppColors.splashSky
        ..strokeWidth = 3,
    );

    // Cột
    final colCount = 5;
    final colW = bodyW * 0.06;
    final gap = (bodyW - colCount * colW) / (colCount + 1);
    for (var i = 0; i < colCount; i++) {
      final x = bodyLeft + gap + i * (colW + gap);
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(x, bodyTop + bodyH * 0.08, colW, bodyH * 0.78),
          const Radius.circular(1),
        ),
        Paint()..color = AppColors.warm100,
      );
    }

    // Cửa sổ xanh
    final winPaint = Paint()
      ..color = AppColors.splashSky.withValues(alpha: 0.75);
    final winSize = bodyW * 0.07;
    for (var row = 0; row < 2; row++) {
      for (var col = 0; col < 4; col++) {
        final x = bodyLeft + bodyW * 0.12 + col * (winSize + bodyW * 0.06);
        final y = bodyTop + bodyH * 0.16 + row * (winSize + bodyH * 0.10);
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromLTWH(x, y, winSize, winSize * 1.1),
            const Radius.circular(1),
          ),
          winPaint,
        );
      }
    }

    // Cửa chính
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(
          center: Offset(center.dx, bodyTop + bodyH * 0.82),
          width: bodyW * 0.14,
          height: bodyH * 0.22,
        ),
        const Radius.circular(2),
      ),
      Paint()..color = AppColors.peacockBlue,
    );

    // Cột cờ trên mái
    canvas.drawLine(
      Offset(center.dx, pedTop),
      Offset(center.dx, pedTop - bodyH * 0.22),
      Paint()
        ..color = AppColors.warm700
        ..strokeWidth = 2,
    );
    canvas.drawPath(
      Path()
        ..moveTo(center.dx, pedTop - bodyH * 0.22)
        ..lineTo(center.dx + bodyW * 0.12, pedTop - bodyH * 0.16)
        ..lineTo(center.dx, pedTop - bodyH * 0.10)
        ..close(),
      Paint()..color = AppColors.primary,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _ConstellationPainter extends CustomPainter {
  const _ConstellationPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1
      ..style = PaintingStyle.stroke;

    final nodes = [
      Offset(size.width * 0.12, size.height * 0.18),
      Offset(size.width * 0.42, size.height * 0.08),
      Offset(size.width * 0.72, size.height * 0.22),
      Offset(size.width * 0.58, size.height * 0.52),
      Offset(size.width * 0.28, size.height * 0.62),
    ];

    final path = Path()..moveTo(nodes[0].dx, nodes[0].dy);
    for (var i = 1; i < nodes.length; i++) {
      path.lineTo(nodes[i].dx, nodes[i].dy);
    }
    canvas.drawPath(path, paint);

    final dot = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    for (final node in nodes) {
      canvas.drawCircle(node, 2.5, dot);
    }
  }

  @override
  bool shouldRepaint(covariant _ConstellationPainter oldDelegate) =>
      oldDelegate.color != color;
}

class _DashedSquarePainter extends CustomPainter {
  const _DashedSquarePainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1.2
      ..style = PaintingStyle.stroke;

    const dash = 4.0;
    const gap = 3.0;
    final rect = Rect.fromLTWH(2, 2, size.width - 4, size.height - 4);

    for (final metric in [
      _LineMetric(rect.topLeft, rect.topRight),
      _LineMetric(rect.topRight, rect.bottomRight),
      _LineMetric(rect.bottomRight, rect.bottomLeft),
      _LineMetric(rect.bottomLeft, rect.topLeft),
    ]) {
      _drawDashedLine(canvas, metric.start, metric.end, paint, dash, gap);
    }
  }

  void _drawDashedLine(
    Canvas canvas,
    Offset start,
    Offset end,
    Paint paint,
    double dash,
    double gap,
  ) {
    final total = (end - start).distance;
    if (total == 0) return;
    final direction = (end - start) / total;
    var drawn = 0.0;
    while (drawn < total) {
      final segEnd = drawn + dash > total ? total : drawn + dash;
      canvas.drawLine(
        start + direction * drawn,
        start + direction * segEnd,
        paint,
      );
      drawn += dash + gap;
    }
  }

  @override
  bool shouldRepaint(covariant _DashedSquarePainter oldDelegate) =>
      oldDelegate.color != color;
}

class _FourPointStarPainter extends CustomPainter {
  const _FourPointStarPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final r = size.width / 2;
    const c = 0.22;

    final path = Path()
      ..moveTo(center.dx, center.dy - r)
      ..quadraticBezierTo(
        center.dx + r * c,
        center.dy - r * c,
        center.dx + r,
        center.dy,
      )
      ..quadraticBezierTo(
        center.dx + r * c,
        center.dy + r * c,
        center.dx,
        center.dy + r,
      )
      ..quadraticBezierTo(
        center.dx - r * c,
        center.dy + r * c,
        center.dx - r,
        center.dy,
      )
      ..quadraticBezierTo(
        center.dx - r * c,
        center.dy - r * c,
        center.dx,
        center.dy - r,
      )
      ..close();

    canvas.drawPath(path, Paint()..color = color);
  }

  @override
  bool shouldRepaint(covariant _FourPointStarPainter oldDelegate) =>
      oldDelegate.color != color;
}

class _LineMetric {
  const _LineMetric(this.start, this.end);
  final Offset start;
  final Offset end;
}

/// Thanh 3 màu cam – xanh lá – xanh dương.
class SplashColorBar extends StatelessWidget {
  const SplashColorBar({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _segment(AppColors.primary, 32),
        const SizedBox(width: Insets.xs),
        _segment(AppColors.splashHillGreen, 32),
        const SizedBox(width: Insets.xs),
        _segment(AppColors.splashSky, 32),
      ],
    );
  }

  Widget _segment(Color color, double width) {
    return Container(
      width: width,
      height: 3,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(Radii.sm),
      ),
    );
  }
}

/// Thẻ logo trắng bo góc — khung cho linh vật Cóc Vàng.
class SplashLogoTile extends StatelessWidget {
  const SplashLogoTile({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(Radii.xl),
        boxShadow: const [
          BoxShadow(
            color: Color(0x26000000),
            blurRadius: 24,
            offset: Offset(0, 8),
          ),
          BoxShadow(
            color: Color(0x0F000000),
            blurRadius: 6,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(Radii.xl),
        child: Padding(padding: const EdgeInsets.all(Insets.lg), child: child),
      ),
    );
  }
}
