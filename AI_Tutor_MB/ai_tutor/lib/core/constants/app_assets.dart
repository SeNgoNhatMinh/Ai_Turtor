/// Đường dẫn asset dùng chung. Khai báo tập trung để tránh gõ sai chuỗi.
abstract final class AppAssets {
  /// Linh vật chat — Cóc mũ tốt nghiệp (ảnh user gửi, cùng web).
  static const tutorMascot = 'assets/images/mascot.jpg';

  /// Cóc FPT Education mới (badge tròn) — dùng thống nhất toàn app.
  static const cocFptEducation = 'assets/images/coc_fpt_education.jpg';

  /// Alias mascot — file thật cùng nội dung Cóc mới (tránh hot-reload thiếu path cũ).
  static const cocVangLogo = 'assets/images/coc_vang_tutor.png';
  static const cocVangLogoTransparent =
      'assets/images/coc_vang_tutor_transparent.png';
  static const cocHero = 'assets/images/coc_hero.png';

  /// Nút Hỏi Cóc (bottom nav).
  static const askCocButton = 'assets/images/ask_coc_button.jpg';

  /// Cóc theo môn (sticker) — dùng cùng Cóc mới.
  static const cocSubjectCampus = cocFptEducation;
  static const cocSubjectCode = cocFptEducation;
  static const cocSubjectBooks = cocFptEducation;
  static const cocSubjectMath = cocFptEducation;

  /// Line-art môn học (thẻ khóa học).
  static const courseArtCampus = 'assets/images/course_art_campus.png';
  static const courseArtLaptop = 'assets/images/course_art_laptop.png';
  static const courseArtBooks = 'assets/images/course_art_books.png';
  static const courseArtMath = 'assets/images/course_art_math.png';

  /// Banner home FPTU (Cóc 3D + campus) — ảnh gốc user.
  static const homeHeroFptu = 'assets/images/home_hero_fptu.jpg';

  /// Logo FPT Corporation chính thức (F xanh · P cam · T lục).
  static const fptLogo = 'assets/images/fpt_logo.png';

  /// Splash Academic Portal — artwork đầy đủ (FPT University).
  static const academicPortalSplash =
      'assets/images/fpt_academic_portal_splash.jpg';

  /// Minh họa đáy màn login (Cóc + campus).
  static const loginCampusIllustration =
      'assets/images/login_campus_illustration.jpg';
}

/// Chuỗi thương hiệu hiển thị giống nhau ở mọi ngôn ngữ (không dịch).
abstract final class AppBrand {
  static const portalTagline = 'Academic Portal';
  static const slogan = 'Học tập chủ động – Kiến tạo tương lai';
  static const versionLabel = 'Version 2.0.3';
}
