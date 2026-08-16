/// Đường dẫn asset dùng chung. Khai báo tập trung để tránh gõ sai chuỗi.
abstract final class AppAssets {
  /// Logo linh vật "Cóc Vàng Tutor" — lưu tại assets/images/coc_vang_tutor.png
  static const cocVangLogo = 'assets/images/coc_vang_tutor.png';

  /// Bản đã xóa nền trắng — hero home & nút Hỏi Cóc.
  static const cocVangLogoTransparent =
      'assets/images/coc_vang_tutor_transparent.png';

  /// Splash Academic Portal — artwork đầy đủ (FPT University).
  static const academicPortalSplash =
      'assets/images/fpt_academic_portal_splash.png';
}

/// Chuỗi thương hiệu hiển thị giống nhau ở mọi ngôn ngữ (không dịch).
abstract final class AppBrand {
  static const portalTagline = 'Academic Portal';
  static const slogan = 'Học tập chủ động – Kiến tạo tương lai';
  static const versionLabel = 'Version 2.0.3';
}
