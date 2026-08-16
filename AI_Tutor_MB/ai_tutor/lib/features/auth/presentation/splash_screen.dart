import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_assets.dart';
import '../../../core/theme/app_motion.dart';

/// Splash Academic Portal — artwork tham chiếu FPT University (full-bleed).
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: Scaffold(
        backgroundColor: Colors.white,
        body: GestureDetector(
          onTap: () => context.go('/login'),
          behavior: HitTestBehavior.opaque,
          child: Semantics(
            button: true,
            label: 'Academic Portal — chạm để đăng nhập',
            child: Image.asset(
              AppAssets.academicPortalSplash,
              fit: BoxFit.cover,
              width: double.infinity,
              height: double.infinity,
              alignment: Alignment.center,
              filterQuality: FilterQuality.high,
              errorBuilder: (_, __, ___) => const Center(
                child: Icon(
                  Icons.image_not_supported_outlined,
                  size: 48,
                  color: Colors.black38,
                ),
              ),
            )
                .animate()
                .fadeIn(duration: Motion.page, curve: Curves.easeOutCubic),
          ),
        ),
      ),
    );
  }
}
