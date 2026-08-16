import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';

/// Header cam + sóng xanh cho trang cá nhân.
class ProfileHeaderDecoration extends StatelessWidget {
  const ProfileHeaderDecoration({super.key});

  @override
  Widget build(BuildContext context) {
    return const CustomPaint(
      painter: _ProfileHeaderPainter(),
      size: Size.infinite,
    );
  }
}

class _ProfileHeaderPainter extends CustomPainter {
  const _ProfileHeaderPainter();

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Paint()..color = AppColors.primary,
    );

    // Dải xanh dương mỏng — accent nhẹ giữa cam và xanh lá
    final waveBlue = Path()
      ..moveTo(0, size.height * 0.66)
      ..quadraticBezierTo(
        size.width * 0.45,
        size.height * 0.71,
        size.width * 0.7,
        size.height * 0.67,
      )
      ..quadraticBezierTo(
        size.width * 0.92,
        size.height * 0.64,
        size.width,
        size.height * 0.68,
      )
      ..lineTo(size.width, size.height * 0.74)
      ..quadraticBezierTo(
        size.width * 0.55,
        size.height * 0.78,
        size.width * 0.25,
        size.height * 0.73,
      )
      ..lineTo(0, size.height * 0.72)
      ..close();
    canvas.drawPath(
      waveBlue,
      Paint()..color = AppColors.peacockBlue.withValues(alpha: 0.55),
    );

    final wave1 = Path()
      ..moveTo(0, size.height * 0.72)
      ..quadraticBezierTo(
        size.width * 0.35,
        size.height * 0.82,
        size.width * 0.55,
        size.height * 0.74,
      )
      ..quadraticBezierTo(
        size.width * 0.8,
        size.height * 0.66,
        size.width,
        size.height * 0.76,
      )
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(wave1, Paint()..color = const Color(0xFF7CBD42));

    final wave2 = Path()
      ..moveTo(0, size.height * 0.8)
      ..quadraticBezierTo(
        size.width * 0.5,
        size.height * 0.92,
        size.width,
        size.height * 0.84,
      )
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(wave2, Paint()..color = AppColors.authScreenBg);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
