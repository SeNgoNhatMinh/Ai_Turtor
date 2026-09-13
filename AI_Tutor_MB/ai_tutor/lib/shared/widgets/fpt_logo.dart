import 'package:flutter/material.dart';

import '../../core/constants/app_assets.dart';
import '../../core/theme/app_colors.dart';

/// Logo FPT Corporation chính thức (F xanh · P cam · T lục · ®).
///
/// Dùng file raster đã tách nền — không kéo giãn, không đổi màu.
class FptLogo extends StatelessWidget {
  const FptLogo({
    super.key,
    this.height = 28,
    this.semanticLabel = 'FPT',
    this.alignment = Alignment.centerLeft,
  });

  final double height;
  final String semanticLabel;
  final Alignment alignment;

  /// Tỉ lệ file `assets/images/fpt_logo.png` sau khi crop.
  static const aspectRatio = 931 / 576;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: semanticLabel,
      image: true,
      child: Image.asset(
        AppAssets.fptLogo,
        height: height,
        width: height * aspectRatio,
        fit: BoxFit.contain,
        alignment: alignment,
        filterQuality: FilterQuality.high,
        gaplessPlayback: true,
      ),
    );
  }
}

/// Thanh 3 màu FPT — mép hero / header, không phải chip.
class FptTricolorBar extends StatelessWidget {
  const FptTricolorBar({super.key, this.height = 4});

  final double height;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      width: double.infinity,
      child: const Row(
        children: [
          Expanded(child: ColoredBox(color: AppColors.fptBlue)),
          Expanded(child: ColoredBox(color: AppColors.fptOrange)),
          Expanded(child: ColoredBox(color: AppColors.fptGreen)),
        ],
      ),
    );
  }
}
