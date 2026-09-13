import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/constants/app_assets.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';

/// Header login — chỉ Cóc lớn (không logo FPT).
class LoginSplashHeader extends StatelessWidget {
  const LoginSplashHeader({super.key, required this.height});

  final double height;

  /// Đường kính Cóc — nổi bật trên nền navy.
  static const cocSize = 128.0;

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: SizedBox(
        height: height,
        width: double.infinity,
        child: Stack(
          fit: StackFit.expand,
          children: [
            const ColoredBox(color: AppColors.loginNavy),
            const CustomPaint(painter: _LoginDotPatternPainter()),
            SafeArea(
              bottom: false,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: Insets.sm),
                  child: Container(
                    width: cocSize,
                    height: cocSize,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 3.5),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.28),
                          blurRadius: 18,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: ClipOval(
                      child: Image.asset(
                        AppAssets.cocFptEducation,
                        fit: BoxFit.cover,
                        filterQuality: FilterQuality.high,
                        gaplessPlayback: true,
                        errorBuilder: (_, __, ___) => Image.asset(
                          AppAssets.askCocButton,
                          fit: BoxFit.cover,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LoginDotPatternPainter extends CustomPainter {
  const _LoginDotPatternPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0x40B8D4F0)
      ..style = PaintingStyle.fill;

    void cluster(double ox, double oy, int cols, int rows) {
      const step = 10.0;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          canvas.drawCircle(
            Offset(ox + c * step, oy + r * step),
            1.5,
            paint,
          );
        }
      }
    }

    cluster(size.width * 0.06, size.height * 0.18, 5, 4);
    cluster(size.width * 0.72, size.height * 0.42, 5, 4);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
