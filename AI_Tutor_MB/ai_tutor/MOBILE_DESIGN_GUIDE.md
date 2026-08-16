# AI Tutor FPT — Mobile App Design Guide (Flutter)

> **Mục đích.** Tài liệu này là **single source of truth** cho UI/UX của app mobile AI Tutor (Flutter) dành cho **sinh viên** và **giảng viên** trường **Đại học FPT**. Nó vừa là design system, vừa là blueprint từng màn hình map với API backend thật, vừa là bộ rule cho Cursor & Claude. Đọc kỹ phần [§3 Anti-AI-Slop](#3-anti-ai-slop--12-quy-tắc-bắt-buộc) trước khi code bất kỳ widget nào.
>
> **Brand:** Trắng + Cam FPT (`#F37021`) + logo FPT University. **Ngôn ngữ:** UI tiếng Việt, code/term tiếng Anh.
> **App model:** *Một app duy nhất, role-aware* (sau login UI đổi theo role). **Stack:** Flutter 3.9+, Riverpod, go_router.
> **Companion files:** [`CLAUDE.md`](CLAUDE.md), [`.cursor/rules/*.mdc`](.cursor/rules/) — đọc kèm.

---

## Mục lục

1. [Design North Star](#1-design-north-star)
2. [Brand & Design Tokens](#2-brand--design-tokens)
3. [Anti-AI-Slop — 12 quy tắc bắt buộc](#3-anti-ai-slop--12-quy-tắc-bắt-buộc)
4. [Foundation trong Flutter (Theme + tokens code)](#4-foundation-trong-flutter)
5. [Component Library](#5-component-library)
6. [Kiến trúc & Folder Structure](#6-kiến-trúc--folder-structure)
7. [Information Architecture & Navigation](#7-information-architecture--navigation)
8. [Screen Blueprints — Student](#8-screen-blueprints--student)
9. [Screen Blueprints — Teacher / Mentor](#9-screen-blueprints--teacher--mentor)
10. [Screen Blueprints — Shared](#10-screen-blueprints--shared)
11. [Backend & n8n Integration](#11-backend--n8n-integration)
12. [Domain Status → UI Mapping](#12-domain-status--ui-mapping)
13. [Accessibility, i18n & Performance](#13-accessibility-i18n--performance)
14. [Roadmap triển khai](#14-roadmap-triển-khai)
15. [Appendix — Full API Reference](#15-appendix--full-api-reference)

---

## 1. Design North Star

**Một câu:** *"Một người bạn học thông minh, đáng tin của FPT — ấm áp như giấy vở, sắc bén như code editor."*

Ba tính từ định hướng mọi quyết định thiết kế:

| Tính từ | Nghĩa trong UI |
|---|---|
| **Warm (ấm)** | Nền off-white ngả be (không phải trắng tinh #FFF), bóng đổ tông ấm, bo góc mềm, typography nhân văn. Cam FPT là "dấu nhấn", không phải "lớp sơn". |
| **Focused (tập trung)** | Mỗi màn hình có đúng 1 hành động chính. Hierarchy rõ bằng size/weight, không bằng màu loè loẹt. Whitespace rộng rãi. |
| **Trustworthy (đáng tin)** | Trạng thái AI minh bạch (confidence, nguồn tài liệu, "đang escalate cho giảng viên"). Không bao giờ giả vờ chắc chắn. Loading/empty/error được thiết kế tử tế. |

**Cảm hứng tham chiếu (mức chất lượng cần đạt):** Linear (độ sắc nét + motion), Duolingo (sự thân thiện học tập), Notion (typography + whitespace), Things 3 (micro-interaction). **Không** tham chiếu: template dashboard generic, Material default demo.

**Nguyên tắc số 1:** Nếu một màn hình trông giống "demo Flutter mặc định" hay "AI generate trong 5 giây" → **sai**. Xem [§3](#3-anti-ai-slop--12-quy-tắc-bắt-buộc).

---

## 2. Brand & Design Tokens

### 2.1 Color — bảng token chính thức

Toàn bộ màu phải lấy từ bảng này. **Tuyệt đối không** dùng màu Material mặc định (tím/indigo `#6200EE`, xanh `#2196F3`…).

#### Primary — Cam FPT
| Token | Hex | Dùng cho |
|---|---|---|
| `primary` | `#F37021` | Cam FPT chính thức. CTA chính, brand, active state. |
| `primaryPressed` | `#D85F18` | Trạng thái nhấn của nút cam. |
| `primaryDark` | `#B84D11` | Text/icon cam trên nền sáng cần contrast cao; điểm cuối gradient. |
| `primaryTint` | `#F9966E` | Hover nhẹ, viền active, accent phụ. |
| `primaryWash` | `#FDE7DA` | Nền chip/badge cam, highlight vùng chọn, nền icon tròn. |

#### Secondary (dùng rất tiết chế — chỉ cho data viz & phân loại)
| Token | Hex | Dùng cho |
|---|---|---|
| `leafGreen` | `#51B848` | Màu phụ FPT (xanh lá). Trạng thái "đã hoàn thành" trong chart. |
| `peacockBlue` | `#034EA2` | Màu phụ FPT (xanh dương). Link, info nhấn, một số category. |

#### Surfaces — nền ấm (KHÔNG dùng #FFFFFF cho nền toàn màn hình)
| Token | Hex | Dùng cho |
|---|---|---|
| `canvas` | `#FBF8F5` | **Nền chính toàn app** (scaffold background). Off-white ngả be. |
| `card` | `#FFFFFF` | Nền card/sheet nổi trên canvas. |
| `raised` | `#F5F1EC` | Nền vùng nhấn nhẹ, input field, segmented control. |
| `sunken` | `#F0EBE4` | Nền skeleton base, vùng lõm, divider block. |
| `inverse` | `#211C18` | Nền tối (snackbar, tooltip, code block dark). |

#### Borders
| Token | Hex | Dùng cho |
|---|---|---|
| `borderHairline` | `#E7E0D7` | Viền mảnh mặc định (1px). |
| `borderStrong` | `#D6CCBF` | Viền nhấn, divider quan trọng. |

#### Text
| Token | Hex | Dùng cho |
|---|---|---|
| `textPrimary` | `#1F1A16` | Heading & body chính (charcoal ấm, không phải #000). |
| `textSecondary` | `#5B5249` | Phụ đề, mô tả. |
| `textTertiary` | `#8C8278` | Metadata, caption, placeholder. |
| `textDisabled` | `#B6ADA2` | Disabled. |
| `onOrange` | `#FFFFFF` | Text/icon trên nền cam. |

#### Semantic (mỗi màu có cặp `*-bg` để làm nền nhạt)
| Token | Hex | bg | Dùng cho |
|---|---|---|---|
| `success` | `#2E8B57` | `#E4F3EA` | Hoàn thành, đúng, đã chấm. |
| `warning` | `#E0A106` | `#FBF1D6` | Chờ duyệt, sắp hạn, cần chú ý. |
| `error` | `#D64545` | `#FBE6E4` | Lỗi, trễ hạn, bị từ chối. |
| `info` | `#2F6FB0` | `#E2EDF7` | Thông tin trung tính, đang xử lý. |

#### Neutral warm scale (cho chart, skeleton, fill phụ)
`warm100 #F4EFE9` · `warm300 #DDD4C8` · `warm500 #A89C8D` · `warm700 #6B6157`

#### Overlay & focus
`scrim #211C18A6` (66% opacity) · `focusRing #F37021`

> **Dark mode (Phase 2):** đảo surface về charcoal ấm (`#1A1613`/`#221D19`), giữ cam `#F37021` nhưng dùng `primaryTint #F9966E` cho text cam để đủ contrast. Tokens đã đặt tên semantic nên chỉ cần 1 file `app_colors_dark.dart`.

### 2.2 Typography

**Font (qua `google_fonts`):**
- **Be Vietnam Pro** — toàn bộ UI & body. Lý do: thiết kế *riêng cho tiếng Việt*, dấu thanh cân đối (không bị lệch như Inter/Roboto), tông humanist-geometric hiện đại + thân thiện đúng chất FPT.
- **Space Grotesk** — chỉ cho **số liệu/stat** (GPA, điểm, % dashboard) và eyebrow label. Digit hình học tạo cảm giác kỹ thuật, premium.
- **JetBrains Mono** — code block trong Code Mentor.

> ❌ Cấm dùng Inter/Roboto làm font chính — đọc ra "default generic".

**Type scale** (Be Vietnam Pro; letter-spacing âm nhẹ cho heading lớn):

| Style | Size / Line | Weight | LS | Dùng |
|---|---|---|---|---|
| `displayLg` | 32 / 40 | 700 | -0.5 | Splash, số lớn onboarding |
| `h1` | 28 / 36 | 700 | -0.4 | Tiêu đề màn hình |
| `h2` | 22 / 30 | 600 | -0.3 | Section header |
| `h3` | 18 / 26 | 600 | -0.2 | Card title |
| `bodyLg` | 16 / 24 | 400 | 0 | Body chính, chat |
| `body` | 15 / 22 | 400 | 0 | Body mặc định |
| `label` | 14 / 20 | 500 | 0 | Nút, label, tab |
| `caption` | 13 / 18 | 400 | 0.1 | Metadata |
| `overline` | 11 / 14 | 600 | 0.8 | Eyebrow (UPPERCASE) |
| `stat` | 28 / 32 | 600 | -0.5 | Space Grotesk — số dashboard |
| `code` | 13.5 / 21 | 400 | 0 | JetBrains Mono |

**Quy tắc:** tối đa **3 cỡ chữ / màn hình**. Hierarchy bằng weight + size tương phản mạnh, **không** bằng 5 dòng xám 14–16px na ná nhau.

### 2.3 Spacing — 8pt grid (tuyệt đối)

Chỉ dùng: **4 · 8 · 12 · 16 · 24 · 32 · 48 · 64**. Cấm số lẻ (13px, 7px). Dùng widget `Gap()` thay `SizedBox`.

| Token | px | Dùng |
|---|---|---|
| `xs` | 4 | Khoảng cách icon–label |
| `sm` | 8 | Trong component |
| `md` | 12 | Giữa element gần nhau |
| `lg` | 16 | Padding card, gutter mặc định |
| `xl` | 24 | Giữa các nhóm |
| `2xl` | 32 | Giữa section lớn |
| `3xl` | 48 | Breathing room đầu/cuối màn |

**Screen padding mặc định:** ngang `16`, dọc đầu `24`.

### 2.4 Radius & Elevation

**Radius:** `sm 8` (chip, input) · `md 12` (button) · `lg 16` (card) · `xl 24` (bottom sheet, hero card) · `full 999` (avatar, pill).

**Shadow (2 lớp, tông ấm — KHÔNG dùng #000 thuần):**
```
shadowSm:  0 1px 2px rgba(33,28,24,0.08)
shadowMd:  0 1px 2px rgba(33,28,24,0.08), 0 8px 24px rgba(33,28,24,0.06)
shadowLg:  0 2px 4px rgba(33,28,24,0.08), 0 16px 40px rgba(33,28,24,0.10)
```
Card thường dùng `shadowMd`. **Không** dùng border 1px + shadow cùng lúc trên cùng 1 phần tử (chọn 1).

### 2.5 Motion System

| Tình huống | Duration | Curve | Ghi chú |
|---|---|---|---|
| Page push / pop | 320 / 260ms | easeOutCubic / easeInCubic | Slide 24px + fade (không fade trơn) |
| List stagger | 380ms tổng, delay 40–50ms/item (cap 8) | easeOutCubic | fadeIn + slideY(12px) |
| Button press | scale 0.97 @90ms → bật lại @140ms | easeOut → easeOutBack nhẹ | + haptic `selectionClick` |
| Hero (avatar/card→detail) | 300ms | fastOutSlowIn | flightShuttleBuilder cross-fade |
| Skeleton shimmer | loop 1100ms | easeInOut | base `sunken`, highlight `canvas`; content fade-in 240ms |
| Bottom sheet | 280 / 220ms | easeOutCubic / easeInCubic | scrim 0→0.66 |
| Tab indicator | 240ms | easeOutCubic | underline trượt, width animate |
| AI typing dots | loop 1400ms | easeInOut | 3 chấm lệch pha 160ms |
| Stat count-up | 600–900ms | easeOutCubic | số dashboard đếm lên |

> **Reduced motion:** gate mọi animation trang trí sau `MediaQuery.disableAnimations`; khi bật thì rút về fade 120ms.

### 2.6 Logo FPT University

- File vector (SVG) qua `flutter_svg`. Đặt tại `assets/images/`:
  - `fpt_university_logo.svg` — bản full-color (đặt trên nền sáng).
  - `fpt_university_logo_white.svg` — bản knockout trắng (đặt trên thanh cam / ảnh).
  - `fpt_mark.svg` — chỉ ký hiệu (cho app bar nhỏ).
- **Clear space** = chiều cao chữ "F" mọi phía. **Min width** ~96px (wordmark) / 28px (mark).
- ❌ Không đổi màu gradient, không kéo méo, không thêm shadow/outline, không đặt trên nền rối.
- App bar: logo nhỏ **căn trái** (không center). Logo lớn chỉ ở **Splash / Login / About**.
- ❌ Không dùng logo làm spinner, watermark lặp, hay hoạ tiết nền.

> ⚠️ Logo chưa có trong repo. Tải bộ nhận diện chính thức FPT University và bỏ vào `assets/images/`. Trước khi có file thật, dùng placeholder text "FPT University" bằng Be Vietnam Pro 700 màu `primary` + "EDUCATION" overline.

---

## 3. Anti-AI-Slop — 12 quy tắc bắt buộc

> Đây là phần quan trọng nhất. Vi phạm = reject. Áp dụng cho **mọi** widget.

1. **KHÔNG center mọi thứ.** Body, heading, label form → **căn trái**. Chỉ center cho empty state & 1 CTA đơn lẻ. (Center text nội dung là dấu hiệu AI-generate rõ nhất.)
2. **Bất đối xứng có chủ đích.** Hero lệch, card tràn nhẹ qua mép section, kích thước card trong feed thay đổi. **Tránh** lưới 2×2 toàn ô y hệt.
3. **Độ sâu thật bằng 2 lớp shadow tông ấm** ([§2.4](#24-radius--elevation)) — không dùng 1 shadow #000 cứng hay viền 1px phẳng khắp nơi.
4. **Tiết chế gradient.** Tối đa **1** gradient cam (`primary`→`primaryDark`, lệch hue <15°) cho **1** hero/CTA mỗi màn. Không gradient cầu vồng, không mesh tím-xanh, không gradient cho text.
5. **Không màu Material mặc định.** Mọi accent lấy từ token FPT. Cả link/switch cũng dùng cam hoặc `peacockBlue`, không `#2196F3`.
6. **Giữ 8pt grid tôn giáo.** Spacing chỉ từ thang [§2.3]. Cấm padding 13/7px.
7. **Whitespace rộng & có chủ đích.** Giữa section 24–32px, trong component 4–8px. 16px đều khắp nơi = trông template.
8. **Thiết kế đủ 4 state cho mọi data surface:** loading (skeleton brand, không spinner giữa màn), empty (illustration + 1 action rõ), error (nguyên nhân + retry), populated. Không để màn trắng hay spinner vô tận.
9. **Để type hierarchy làm việc.** ≤3 cỡ chữ/màn, tương phản weight/size mạnh. Tránh 5 dòng xám na ná.
10. **Micro-interaction có mục đích:** press-scale, haptic ở tap quan trọng, tab indicator động, count-up số liệu — nhưng <350ms và **không** animate mọi thứ cùng lúc.
11. **Dùng màu tiết chế & semantic.** Cam = hành động chính/brand **thôi**. Đừng tô cam mọi card/icon/border. Để warm-neutral gánh ~80% bề mặt, cam là "dấu chấm câu".
12. **Label + icon, không "mystery-meat".** Nav có cả icon + chữ. Dùng **một** bộ icon nhất quán (chọn outline *hoặc* filled, không trộn). Khuyến nghị: `lucide_icons` hoặc `phosphor_flutter` (đồng đều, hiện đại hơn Material Icons).

---

## 4. Foundation trong Flutter

> Token = code, không chỉ là docs. Tạo `lib/core/theme/` với các file dưới. Đây là bản canonical — copy nguyên.

### 4.1 `app_colors.dart`
```dart
import 'package:flutter/material.dart';

/// FPT brand tokens — KHÔNG hard-code hex ngoài file này.
abstract final class AppColors {
  // Primary
  static const primary        = Color(0xFFF37021);
  static const primaryPressed = Color(0xFFD85F18);
  static const primaryDark    = Color(0xFFB84D11);
  static const primaryTint    = Color(0xFFF9966E);
  static const primaryWash    = Color(0xFFFDE7DA);

  // Secondary (dùng tiết chế)
  static const leafGreen   = Color(0xFF51B848);
  static const peacockBlue = Color(0xFF034EA2);

  // Surfaces
  static const canvas  = Color(0xFFFBF8F5);
  static const card    = Color(0xFFFFFFFF);
  static const raised  = Color(0xFFF5F1EC);
  static const sunken  = Color(0xFFF0EBE4);
  static const inverse = Color(0xFF211C18);

  // Borders
  static const borderHairline = Color(0xFFE7E0D7);
  static const borderStrong   = Color(0xFFD6CCBF);

  // Text
  static const textPrimary   = Color(0xFF1F1A16);
  static const textSecondary = Color(0xFF5B5249);
  static const textTertiary  = Color(0xFF8C8278);
  static const textDisabled  = Color(0xFFB6ADA2);
  static const onOrange      = Color(0xFFFFFFFF);

  // Semantic
  static const success = Color(0xFF2E8B57);  static const successBg = Color(0xFFE4F3EA);
  static const warning = Color(0xFFE0A106);  static const warningBg = Color(0xFFFBF1D6);
  static const error   = Color(0xFFD64545);  static const errorBg   = Color(0xFFFBE6E4);
  static const info    = Color(0xFF2F6FB0);  static const infoBg    = Color(0xFFE2EDF7);

  // Neutral warm
  static const warm100 = Color(0xFFF4EFE9);
  static const warm300 = Color(0xFFDDD4C8);
  static const warm500 = Color(0xFFA89C8D);
  static const warm700 = Color(0xFF6B6157);

  static const scrim = Color(0xA6211C18);

  // Gradient brand DUY NHẤT được phép
  static const brandGradient = LinearGradient(
    begin: Alignment.topLeft, end: Alignment.bottomRight,
    colors: [primary, primaryDark],
  );
}
```

### 4.2 `app_spacing.dart`, `app_radius.dart`, `app_motion.dart`
```dart
abstract final class Insets {
  static const double xs = 4, sm = 8, md = 12, lg = 16, xl = 24, xxl = 32, xxxl = 48;
  static const double screenH = 16, screenTop = 24;
}
abstract final class Radii {
  static const double sm = 8, md = 12, lg = 16, xl = 24, full = 999;
}
abstract final class Motion {
  static const fast    = Duration(milliseconds: 140);
  static const base    = Duration(milliseconds: 240);
  static const page    = Duration(milliseconds: 320);
  static const pageBack= Duration(milliseconds: 260);
  static const sheet   = Duration(milliseconds: 280);
  // curves: dùng Curves.easeOutCubic / easeInCubic / fastOutSlowIn
}
abstract final class Shadows {
  static const md = [
    BoxShadow(color: Color(0x14211C18), blurRadius: 2,  offset: Offset(0, 1)),
    BoxShadow(color: Color(0x0F211C18), blurRadius: 24, offset: Offset(0, 8)),
  ];
  static const lg = [
    BoxShadow(color: Color(0x14211C18), blurRadius: 4,  offset: Offset(0, 2)),
    BoxShadow(color: Color(0x1A211C18), blurRadius: 40, offset: Offset(0, 16)),
  ];
}
```

### 4.3 `app_typography.dart` + `app_theme.dart` (rút gọn)
```dart
import 'package:google_fonts/google_fonts.dart';
// body = Be Vietnam Pro; stat = Space Grotesk; code = JetBrains Mono.
TextTheme buildTextTheme() {
  final base = GoogleFonts.beVietnamProTextTheme();
  return base.copyWith(
    displayLarge: GoogleFonts.beVietnamPro(fontSize: 32, height: 1.25, fontWeight: FontWeight.w700, letterSpacing: -0.5, color: AppColors.textPrimary),
    headlineMedium: GoogleFonts.beVietnamPro(fontSize: 28, height: 1.29, fontWeight: FontWeight.w700, letterSpacing: -0.4, color: AppColors.textPrimary),
    titleLarge:  GoogleFonts.beVietnamPro(fontSize: 22, height: 1.36, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
    titleMedium: GoogleFonts.beVietnamPro(fontSize: 18, height: 1.44, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
    bodyLarge:   GoogleFonts.beVietnamPro(fontSize: 16, height: 1.5,  fontWeight: FontWeight.w400, color: AppColors.textPrimary),
    bodyMedium:  GoogleFonts.beVietnamPro(fontSize: 15, height: 1.47, fontWeight: FontWeight.w400, color: AppColors.textSecondary),
    labelLarge:  GoogleFonts.beVietnamPro(fontSize: 14, height: 1.43, fontWeight: FontWeight.w500, color: AppColors.textPrimary),
    bodySmall:   GoogleFonts.beVietnamPro(fontSize: 13, height: 1.38, fontWeight: FontWeight.w400, color: AppColors.textTertiary),
  );
}
TextStyle statStyle() => GoogleFonts.spaceGrotesk(fontSize: 28, height: 1.14, fontWeight: FontWeight.w600, letterSpacing: -0.5, color: AppColors.textPrimary);

ThemeData buildAppTheme() {
  const scheme = ColorScheme.light(
    primary: AppColors.primary, onPrimary: AppColors.onOrange,
    secondary: AppColors.peacockBlue, surface: AppColors.card,
    error: AppColors.error, onSurface: AppColors.textPrimary,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: AppColors.canvas,   // ← off-white, KHÔNG trắng
    textTheme: buildTextTheme(),
    splashFactory: InkSparkle.splashFactory,
    // ... cấu hình AppBarTheme/CardTheme/InputDecorationTheme map vào token.
  );
}
```

> **Quy tắc:** widget **không** được viết `Color(0x...)`, `EdgeInsets.all(13)`, hay `GoogleFonts.inter()`. Luôn qua `AppColors`, `Insets`, `Radii`, `Theme.of(context).textTheme`.

---

## 5. Component Library

Mỗi component dưới đây là 1 widget tái sử dụng trong `lib/shared/widgets/`. Spec gồm: anatomy + state. **Coding bắt đầu từ component, không từ màn hình.**

### 5.1 Buttons (`FptButton`)
- **Variants:** `primary` (nền `primary`, text `onOrange`, `shadowMd`), `secondary` (nền `card`, viền `borderStrong`, text `textPrimary`), `tonal` (nền `primaryWash`, text `primaryDark`), `ghost` (chỉ text cam), `destructive` (nền `error`).
- **Sizes:** `lg` (h52, radius `md`, dùng full-width CTA), `md` (h44), `sm` (h36, chip-like).
- **States:** default / pressed (scale 0.97 + màu pressed) / loading (spinner cam + chữ mờ, **giữ nguyên width**) / disabled (`textDisabled` + nền `raised`).
- Press → `HapticFeedback.selectionClick()`.

### 5.2 Cards (`FptCard`)
- Nền `card`, radius `lg`, padding `lg`, `Shadows.md`. **Không** viền nếu đã có shadow.
- Tappable card: thêm press-scale 0.99 + ripple `primaryWash`.
- Variant `outlined` (nền `canvas`, viền `borderHairline`, không shadow) cho list dày.

### 5.3 Status Pill (`StatusPill`) — xem [§12](#12-domain-status--ui-mapping)
- Nền `*-bg`, text/dot màu semantic, radius `full`, padding `4×10`, `caption` weight 500. Có dot tròn 6px đầu pill.

### 5.4 Input (`FptTextField`)
- Nền `raised`, radius `md`, không viền ở rest; focus → viền 1.5px `focusRing` + nền `card`. Label nổi (floating) `label` style. Error → viền `error` + helper `error`.
- Search field: leading icon `textTertiary`, clear button xuất hiện khi có text.

### 5.5 Chat Bubble (`ChatBubble`) — dùng cho AI Tutor & live chat
- **User:** căn phải, nền `primary`, text `onOrange`, radius `lg` với góc dưới-phải `sm` (đuôi).
- **AI/Mentor:** căn trái, nền `card` + `Shadows.md`, text `textPrimary`, góc dưới-trái `sm`. Avatar/logo nhỏ bên trái.
- **AI content** render bằng `flutter_markdown`; code block dùng `flutter_highlight` (theme warm) + nút copy.
- **Meta row** dưới bubble AI: chip `mode` (RAG_TUTOR/CODE_MENTOR/ESCALATE), `confidence` bar nhỏ, danh sách `sources` (chip có icon tài liệu).
- **Review bar** dưới mỗi câu trả lời AI: `[👍 Hữu ích] [👎 Sai] [⚑ Báo lỗi] [✎ Góp ý]` → xem [§8.3](#83-ai-tutor-chat).
- **Typing indicator:** 3 chấm loop 1400ms khi AI đang trả lời.

### 5.6 Bottom Navigation (`FptBottomNav`)
- Nền `card`, top hairline border, `shadowLg` hướng lên. Item: icon + label (`caption`). Active: icon filled + màu `primary` + indicator pill `primaryWash` phía sau, animate 240ms. Inactive: `textTertiary` outline.
- Haptic khi đổi tab. **Không** dùng FAB notch trừ khi có hành động trung tâm thật.

### 5.7 App Bar (`FptAppBar`)
- Nền `canvas` (blend với scaffold), không elevation khi ở top; khi scroll → hiện hairline + `shadowSm` mờ.
- Title `h2` căn trái. Trailing actions tối đa 2 icon + 1 avatar.

### 5.8 State widgets (bắt buộc cho mọi data surface)
- `LoadingSkeleton` — dùng `skeletonizer` bọc layout thật. Base `sunken`, shimmer 1100ms.
- `EmptyState` — illustration (Lottie/SVG brand-tint) + heading `h3` + 1 dòng phụ + 1 CTA. Đây là chỗ **duy nhất** được center.
- `ErrorState` — icon `error` nhạt + nguyên nhân ngắn + nút "Thử lại".
- `OfflineBanner` — banner mỏng `warningBg` trên cùng khi mất mạng.

### 5.9 Khác
- `Avatar` (`cached_network_image`, fallback initials trên nền `primaryWash`), `RatingStars` (cam), `ConfidenceBar`, `SectionHeader` (overline + h2 + "Xem tất cả"), `FileChip` (icon loại file + tên + size + tải), `CourseTile`, `MentorCard`, `AssignmentTile`, `WeakTopicChip` (nền `warningBg`).

---

## 6. Kiến trúc & Folder Structure

**State:** Riverpod (`flutter_riverpod` + `flutter_hooks`). **Nav:** go_router (ShellRoute cho mỗi role). **HTTP:** `dio`. **Model:** `freezed` + `json_serializable`.

```
lib/
├─ main.dart
├─ app.dart                      # MaterialApp.router + theme + router
├─ core/
│  ├─ theme/                     # app_colors / typography / spacing / radius / motion / app_theme
│  ├─ config/                    # env.dart (baseUrl, n8nWebhookUrl), constants
│  ├─ network/                   # dio_client, interceptors, api_result, exceptions
│  ├─ router/                    # app_router.dart, routes.dart, shells
│  └─ utils/                     # formatters (ngày VN, file size), validators, haptics
├─ shared/
│  ├─ widgets/                   # FptButton, FptCard, ChatBubble, StatusPill, state widgets...
│  └─ models/                    # User, Course, Enrollment, Assignment... (freezed)
├─ features/
│  ├─ auth/        # login, register, splash, onboarding
│  ├─ home/        # student home & teacher home (role shells)
│  ├─ courses/     # course list, detail, materials
│  ├─ ai_tutor/    # conversation list, chat, review, code mentor
│  ├─ escalation/  # offer, mentor matching, live chat
│  ├─ assignments/ # student + teacher views, submit, grade
│  ├─ memory/      # weak topics, improve plan
│  ├─ dashboard/   # student & teacher dashboards
│  ├─ review_queue/# mentor-pending, senior-pending, knowledge candidates
│  └─ profile/     # profile, settings, subscription (phase 2)
└─ l10n/                         # vi (mặc định), en
```
Mỗi feature: `presentation/` (screens + widgets), `application/` (Riverpod providers/controllers), `data/` (repository + dto). Repository trả `AsyncValue` để màn hình map thẳng sang loading/error/data.

**Quy ước đặt tên:** screen = `XxxScreen`, provider = `xxxProvider`, repo = `XxxRepository`. File snake_case. Không để logic trong widget — đẩy vào controller/provider.

---

## 7. Information Architecture & Navigation

App **một** codebase, sau login đọc `role` → đẩy vào shell tương ứng.

### 7.1 Student shell — bottom nav 5 tab
| Tab | Icon | Màn gốc |
|---|---|---|
| **Trang chủ** | home | Student Home (dashboard tóm tắt) |
| **Môn học** | book | Course list → detail → materials |
| **AI Tutor** | sparkles (nhấn) | Conversation list → Chat |
| **Bài tập** | clipboard | Assignment list → submit |
| **Cá nhân** | user | Profile + improve plan + escalation history |

> AI Tutor là tab trung tâm, icon nhấn mạnh hơn (đây là tính năng lõi). Live-chat & code-mentor mở từ trong flow, không phải tab riêng.

### 7.2 Teacher/Mentor shell — bottom nav 5 tab
| Tab | Icon | Màn gốc |
|---|---|---|
| **Tổng quan** | grid | Teacher Dashboard |
| **Lớp học** | users | Class section list → roster, weak topics |
| **Hộp thư** | inbox | Escalation inbox + live chat + answer-review queue (có badge số chờ) |
| **Bài tập** | clipboard | Assignment manage + chấm bài |
| **Cá nhân** | user | Profile (+ Senior queue nếu role = SENIOR_MENTOR/ADMIN) |

### 7.3 Route table (go_router, rút gọn)
```
/splash · /onboarding · /login · /register
Student ShellRoute:
  /s/home · /s/courses · /s/courses/:courseId · /s/courses/:courseId/materials
  /s/tutor (conversation list) · /s/tutor/:conversationId (chat) · /s/tutor/code-mentor
  /s/assignments · /s/assignments/:id · /s/profile · /s/profile/improve/:courseId
  /s/escalation/:escalationId/offer · /chat/:chatRoomId (shared)
Teacher ShellRoute:
  /t/home · /t/classes · /t/classes/:courseId/:classId · /t/classes/:courseId/:classId/students
  /t/inbox · /t/inbox/escalations/:id/answer · /t/review/mentor-pending · /t/review/senior-pending
  /t/candidates (senior) · /t/assignments · /t/assignments/:id/submissions
  /t/submissions/:id/grade · /t/profile · /chat/:chatRoomId (shared)
```

---

## 8. Screen Blueprints — Student

> Format mỗi màn: **Mục đích · Layout · Component · API · States · Micro-interaction.** API dùng tên endpoint backend (xem [§15](#15-appendix--full-api-reference)). Nhớ: các flow **AI** đi qua **n8n webhook**; CRUD đi thẳng Spring Boot ([§11](#11-backend--n8n-integration)).

### 8.1 Splash + Onboarding + Auth
- **Splash:** logo FPT lớn center trên `canvas`, gradient cam rất nhẹ ở 1 góc, mark fade-in + scale 0.96→1 (300ms). Check session → điều hướng. *(Center cho phép vì là splash.)*
- **Onboarding (3 trang):** mỗi trang 1 illustration + heading `h1` + 1 dòng. Page indicator pill cam. Nút "Tiếp"→"Bắt đầu". Skip góc trên phải.
- **Login:** logo nhỏ trên, `h1` "Đăng nhập", `FptTextField` email + password (toggle hiện mật khẩu), CTA `primary lg` "Đăng nhập", link "Đăng ký". → `POST /api/users/login`. Lưu `userId, role, fullName, avatarUrl`. Lỗi → inline error dưới field, không dialog.
- **Register:** fullName, email, phone, password. → `POST /api/users/register` (mặc định role STUDENT). Validate client trước.
- **States:** nút loading giữ width; sai mật khẩu → shake nhẹ + error text.

### 8.2 Student Home (`/s/home`)
- **Mục đích:** mở app thấy ngay "hôm nay học gì, yếu gì, có gì cần làm".
- **Layout (scroll, KHÔNG đối xứng):**
  1. Greeting row: "Chào, {tên} 👋" (`h1`) + avatar phải. Eyebrow overline ngày VN.
  2. **Hero card** (gradient cam DUY NHẤT của màn): "Hỏi AI Tutor" → mở chat. Có subtext + minh hoạ.
  3. **Dải môn học** đang học — horizontal scroll `CourseTile` (kích thước hơi khác nhau để tránh đều tăm tắp).
  4. **Cần làm** — list `AssignmentTile` sắp đến hạn (status pill warning nếu <48h).
  5. **Điểm yếu của bạn** — chip `WeakTopicChip` + nút "Xem kế hoạch cải thiện".
- **API:** `GET /api/students/{id}/courses`, `GET /api/students/{id}/dashboard?requesterId&requesterRole`, `GET /api/students/{id}/assignments`, memory weak topics từ dashboard.
- **States:** skeleton 3 block; empty (chưa enroll) → "Bạn chưa có môn học nào" + liên hệ.
- **Micro:** stat count-up; card stagger khi vào; pull-to-refresh.

### 8.3 AI Tutor — Conversation list + Chat (`/s/tutor`, `/s/tutor/:id`)
**Conversation list (kiểu ChatGPT/Claude sidebar nhưng là full screen mobile):**
- List `AiConversationSummary` (title, messageCount, lastMessageAt relative). Swipe để rename/delete. FAB "+ Cuộc trò chuyện mới".
- **API:** `GET/POST /api/ai/conversations?userId`, `PATCH/DELETE /api/ai/conversations/{id}`.

**Chat screen (màn lõi nhất app):**
- **Header:** title cuộc trò chuyện + selector **môn học** (courseId) — bắt buộc chọn môn để RAG scope đúng. Nhắc nhẹ "AI trả lời theo tài liệu môn {course}".
- **Body:** list `ChatBubble`. AI bubble hiện `mode` chip, `ConfidenceBar`, `sources`. Markdown + code highlight.
- **Khi escalate:** AI bubble đặc biệt nền `infoBg`: "Câu hỏi này cần giảng viên xác minh" + nút "Nhận hỗ trợ từ giảng viên/mentor" → flow [§8.4].
- **Input bar:** multiline, nút đính kèm code (mở Code Mentor), nút gửi cam. Khi gửi: bubble user xuất hiện ngay + typing indicator AI.
- **Review bar** dưới mỗi câu AI: 4 nút → mở bottom sheet chọn `reviewType`:
  - 👍 → `QUALITY_FEEDBACK, accurate=true`
  - 👎 → `ANSWER_DISPUTE, accurate=false`
  - ⚑ Báo lỗi → sheet chọn `SOURCE_CONFLICT` / `MISSING_MATERIAL`
  - ✎ Góp ý → free text
- **API (qua n8n):** gửi câu hỏi → webhook `/student-chat` (n8n gọi intent-classify + `/api/ai/query` hoặc `/api/code-mentor/query` hoặc tạo escalation). Review → webhook `/answer-review` (→ `POST /api/tutor/answer-reviews`). Lịch sử tin nhắn của 1 conversation → `GET /api/ai/conversations/{id}/messages`.
- **States:** typing indicator; lỗi mạng → bubble "Gửi lại"; confidence thấp → badge "AI chưa chắc".
- **Micro:** bubble slide-in từ dưới; sources chip nở ra; haptic khi nhận xong câu trả lời.

### 8.4 Escalation → Mentor matching → Live chat
- **Offer screen (`/s/escalation/:id/offer`):** sau khi AI escalate, hiện "Đề xuất người hỗ trợ". `POST /api/tutor/escalations/offer?questionEscalationId`.
  - Nếu route = **CLASS_TEACHER**: hiện đúng giảng viên lớp (badge "Giảng viên lớp của bạn", matchScore 100).
  - Nếu route = **MENTOR_MATCHING**: list `MentorCard` top-5 (avatar, rating, sessions, `matchReason`, response time, specializations). Card có "lý do gợi ý".
  - Chọn → `POST /api/tutor/escalations/select` → mở ChatRoom. Có nút "Huỷ" → `/cancel`.
- **Live chat (`/chat/:chatRoomId`, shared):** giống ChatBubble nhưng người thật. Header: avatar + tên mentor + dot trạng thái (ACTIVE=green). Hiện "câu hỏi gốc + câu trả lời AI" ở đầu (collapsible). Đính kèm file/ảnh.
  - **API:** `POST /api/chat/send`, `GET /api/chat/history`, `/detail`, `POST /api/chat/mark-read`. Đóng phòng → `POST /api/chat/close` (modal chấm sao + feedback).
  - **Polling** lịch sử mỗi ~4–6s (chưa có websocket) — hiện "đang nhập…" nếu có. Badge unread từ `/api/chat/unread`.
- **States:** chờ mentor accept → "Đang chờ {mentor} phản hồi" + skeleton; phòng đóng → banner + read-only.

### 8.5 Code Mentor (`/s/tutor/code-mentor`)
- **Mục đích:** dán code/lỗi, nhận giải thích + hint (KHÔNG nhận lời giải full — nhấn mạnh UX này: "Code Mentor hướng dẫn, không làm hộ").
- **Layout:** code editor field (mono, line số, syntax highlight), dropdown `language`, ô câu hỏi, toggle "Liên quan bài tập?" (`assignmentRelated` → bật guardrail mạnh hơn), nút "Hỏi". Hoặc tab "Tải file" (`/api/code-mentor/upload`).
- **API:** `POST /api/code-mentor/query` `{studentId, courseId, classId, question, code, language, assignmentRelated, conversationId}`. Response hiện `answer` (markdown), `weakTopics` (chip), badge nếu `assignmentSafetyApplied=true` ("Đã giới hạn để bảo vệ mục tiêu học tập").
- **Micro:** code block có nút copy; weakTopics chip bay vào.

### 8.6 Courses & Materials (`/s/courses`, `/s/courses/:id`, `/materials`)
- **List:** `CourseTile` (mã môn, tên, tên lớp, học kỳ, status pill ACTIVE/COMPLETED). `GET /api/students/{id}/courses`.
- **Detail:** header môn + tab [Tài liệu] [Bài tập] [Trí nhớ học tập (memory)] [Hỏi AI về môn này].
- **Materials:** list `FileChip` (`GET /api/courses/{courseId}/materials`). Tap PDF → viewer (`GET .../{materialId}/pdf`). Empty → "Giảng viên chưa tải tài liệu".

### 8.7 Assignments — Student (`/s/assignments`, `/:id`)
- **List:** `AssignmentTile` group theo môn; mỗi tile: title, dueAt (đếm ngược, pill warning/error), trạng thái nộp (chưa nộp / đã nộp `SUBMITTED` / đã chấm `REVIEWED` + điểm). `GET /api/students/{id}/assignments`, `GET /api/students/{id}/submissions`.
- **Detail:** mô tả + tải đề (`/api/assignments/{id}/file`) + khu vực nộp (chọn file + note) → `POST /api/students/assignments/{assignmentId}/submit`. Sau khi chấm: hiện `score`, `teacherFeedback`, `weakTopics`.
- **States:** quá hạn → pill error "Trễ hạn"; đã chấm → card success với điểm Space Grotesk lớn.

### 8.8 Improve Plan & Memory (`/s/profile/improve/:courseId`)
- **Mục đích:** biến điểm yếu thành kế hoạch.
- **Layout:** `riskLevel` badge (HIGH error / MEDIUM warning / LOW success), list `weakTopics`, `planItems` dạng checklist, `evidence`. Nút "Tạo gợi ý mới" → `POST /api/tutor/improve-suggestions`. "Đánh dấu hoàn thành" → `PUT /api/improve-plans/{id}/complete`.
- **API:** `GET /api/students/{id}/courses/{courseId}/improve-plan`, `GET /api/students/{id}/improve-plans`. Memory: `GET /api/tutor/students/{id}/courses/{courseId}/memory`.

---

## 9. Screen Blueprints — Teacher / Mentor

### 9.1 Teacher Dashboard (`/t/home`)
- **Layout:** lưới stat card (Space Grotesk): số lớp, số escalation chờ, số bài cần chấm, số review chờ. Dưới: chart weak-topics toàn lớp (`fl_chart` bar/radar, màu cam), list "cần xử lý hôm nay".
- **API:** `GET /api/mentors/{teacherId}/dashboard?requesterId&requesterRole`, `GET /api/mentors/{teacherId}/escalations/inbox`.
- **Micro:** stat count-up; chart vẽ dần.

### 9.2 Classes & Roster (`/t/classes`, `/:courseId/:classId/students`)
- **List lớp:** `GET /api/mentors/{teacherId}/class-sections`. Tile: tên lớp, môn, học kỳ, status, sĩ số.
- **Roster:** `GET /api/courses/{courseId}/class-sections/{classId}/students?teacherId`. List sinh viên + nút xem memory/weak topics. Teacher xem memory cả lớp: `GET /api/tutor/courses/{courseId}/memories?classId`.

### 9.3 Inbox: Escalation + Answer (`/t/inbox`, `/inbox/escalations/:id/answer`)
- **Inbox:** tab [Live chat] [Câu hỏi escalate] [Review chờ mentor]. Badge số chờ trên tab.
- **Escalation list:** `GET /api/tutor/escalations/teachers/{teacherId}` (alias inbox). Mỗi item: câu hỏi gốc + AI response + sinh viên + status pill.
- **Answer screen:** đọc câu hỏi + AI response, ô soạn trả lời, toggle **"Đề xuất làm tri thức cho AI?"** (`createKnowledgeCandidate`) + chọn `candidateType` (ACADEMIC_KNOWLEDGE / MATERIAL_CORRECTION / FAQ_CLARIFICATION) — *chỉ bật khi là tri thức học thuật tái dùng được; với deadline/điểm/quy định lớp thì tắt*. → `POST /api/tutor/escalations/{id}/answer`.
  - UI phải giải thích rõ: bật toggle = tạo candidate **chờ Senior duyệt**, KHÔNG tự vào AI.
- **Live chat:** dùng `/chat/:chatRoomId` (vai trò MENTOR). Unread từ `GET /api/chat/unread?role=MENTOR`.
- **Mentor-review queue:** `GET /api/tutor/answer-reviews/mentor-pending?courseId` — list câu trả lời AI bị dispute; mentor đọc tài liệu, giải thích lại cho SV (hiện chưa có endpoint mentor-resolve riêng → thao tác giải thích qua chat).

### 9.4 Assignments — Teacher (`/t/assignments`, `/:id/submissions`, `/submissions/:id/grade`)
- **Tạo/giao bài:** chọn lớp → upload file + title + description + dueAt + targetType (`ALL_CLASS`/`SELECTED_STUDENTS` → chọn SV). `POST /api/mentor/courses/{courseId}/classes/{classId}/assignments/upload`.
- **Danh sách submissions:** `GET /api/mentor/assignments/{assignmentId}/submissions`. Mỗi item: SV, file nộp, status, điểm.
- **Chấm bài:** tải file SV (`/api/submissions/{id}/file`), nhập `score`, `teacherFeedback`, `weakTopics` (chip input) → `PUT /api/mentor/submissions/{submissionId}/review`. *(Chưa có AI auto-grade — chấm tay hoàn toàn.)*

### 9.5 Senior Mentor / Admin queues (`/t/review/senior-pending`, `/t/candidates`)
> Chỉ hiện khi role = SENIOR_MENTOR hoặc ADMIN. **Đây là cổng duy nhất AI được học.**
- **Senior-pending reviews:** `GET /api/tutor/answer-reviews/senior-pending?courseId`. Resolve → `POST /api/tutor/answer-reviews/{id}/senior-resolve` (decision CREATE_KNOWLEDGE_CANDIDATE / REJECT_FEEDBACK + correctedAnswer + candidateType).
- **Knowledge Candidates:** `GET /api/tutor/knowledge-candidates/senior-pending?courseId`. Mỗi candidate: câu hỏi + câu trả lời đề xuất + candidateType + nguồn. Hai nút lớn: **Duyệt (Index vào RAG)** `POST .../approve` / **Từ chối** `POST .../reject` (kèm `reviewNote`/`rejectionReason`).
  - UI cảnh báo: chỉ ACADEMIC_KNOWLEDGE / MATERIAL_CORRECTION / FAQ_CLARIFICATION được index; người trả lời gốc **không** được tự duyệt candidate của mình (backend chặn → hiện disabled + tooltip).
- **Visual:** card candidate có viền trái màu theo status (warning=chờ, success=indexed, error=rejected), "before → after" nếu có correctedAnswer.

---

## 10. Screen Blueprints — Shared

### 10.1 Profile & Settings (`/s/profile`, `/t/profile`)
- Header: avatar lớn + tên + email + role badge. Edit → `PUT /api/users/{id}/profile` (fullName, phone, avatarUrl, bio, address, city).
- Sections: Thông tin cá nhân · Thông báo · Ngôn ngữ (vi/en) · Giao diện (light/dark phase 2) · Về FPT University (logo lớn) · Đăng xuất.
- Student thêm: lịch sử escalation (`GET /api/tutor/escalations/history?userId`), improve plans, gói đăng ký (phase 2).

### 10.2 Notifications (chuông app bar)
- Tổng hợp: AI escalate có người nhận, mentor trả lời chat, bài được chấm, candidate được duyệt/từ chối, bài tập mới/sắp hạn. (Hiện backend chưa có endpoint notification tập trung → tổng hợp client-side từ unread chat + assignment + escalation; ghi chú để backend bổ sung sau.)

### 10.3 Subscription (Phase 2 — optional)
- Backend có plan TRIAL/VIP_MONTHLY/PRO_YEARLY nhưng **hiện KHÔNG feature-gate gì cả** (xem [§11.4]). Vì vậy: **không** khoá tính năng theo gói trong phase 1. Nếu làm UI, chỉ là màn "Gói của tôi" + lịch sử payment (`GET /api/payments/user/{userId}`), tạo payment chuyển khoản tay (`POST /api/payments`). Đặt ưu tiên thấp.

---

## 11. Backend & n8n Integration

### 11.1 Hai kênh gọi API — phân biệt rõ
| Loại flow | Gọi qua | Vì sao |
|---|---|---|
| **AI Tutor chat, Answer review, Teacher answer, Senior approval** | **n8n webhook** | n8n là AI Harness điều phối intent-classify → RAG/Code/Escalate, confidence check, update memory. Frontend **không** gọi LLM/AI API trực tiếp. |
| **Mọi CRUD khác** (login, courses, assignments, chat room, dashboard, profile, materials, escalation offer/select…) | **Spring Boot REST trực tiếp** | Business CRUD bình thường. |

### 11.2 Endpoints n8n (4 webhook)
Prefix production `/webhook`, test `/webhook-test`:
| Webhook | Mục đích | Backend nó gọi |
|---|---|---|
| `POST /webhook/student-chat` | Gửi câu hỏi AI Tutor | intent-classify → `/api/ai/query` \| `/api/code-mentor/query` \| `/api/tutor/escalations` + improve + update memory |
| `POST /webhook/answer-review` | SV review câu trả lời AI | `/api/tutor/answer-reviews` |
| `POST /webhook/teacher-answer` | GV trả lời escalation | `/api/tutor/escalations/{id}/answer` |
| `POST /webhook/senior-approval` | Senior duyệt candidate | `/api/tutor/knowledge-candidates/{id}/approve\|reject` |

### 11.3 Config base URL (quan trọng cho mobile)
```dart
// lib/core/config/env.dart
abstract final class Env {
  // Thiết bị thật KHÔNG dùng localhost. Dùng IP LAN máy chạy backend, hoặc domain.
  static const apiBaseUrl   = String.fromEnvironment('API_BASE_URL',  defaultValue: 'http://10.0.2.2:8085'); // 10.0.2.2 = localhost của host trên Android emulator
  static const n8nWebhook   = String.fromEnvironment('N8N_WEBHOOK',   defaultValue: 'http://10.0.2.2:5678/webhook');
}
```
- Android emulator: host = `10.0.2.2`. iOS simulator: `localhost`. Thiết bị thật: IP LAN (vd `192.168.1.x`). Cho phép cleartext HTTP khi dev (Android `network_security_config`).

### 11.4 Bất biến nghiệp vụ phải tôn trọng trong UI
1. **RAG scope theo `courseId`**, không global. `classId` chỉ là context (routing/memory/dashboard) — luôn cho SV chọn **môn** trước khi hỏi AI.
2. **Memory theo `studentId + courseId`** (không theo user). Hiển thị memory/weak-topic luôn gắn với 1 môn.
3. **AI chỉ học qua: KnowledgeCandidate → Senior/Admin duyệt → Elasticsearch → RAG Brain.** Review của SV, câu trả lời mentor, rating **không bao giờ** tự train AI. UI phải truyền đúng thông điệp này (đừng ghi "AI đã học từ phản hồi của bạn").
4. Chỉ `ACADEMIC_KNOWLEDGE / MATERIAL_CORRECTION / FAQ_CLARIFICATION` được index. `OPERATIONAL_POLICY / GRADING_DECISION / CLASS_RULE / ASSIGNMENT_SPECIFIC` **không** vào brain.
5. **Code Mentor không làm hộ bài** — UI nhấn mạnh "hướng dẫn, gợi ý", hiện badge khi `assignmentSafetyApplied`.
6. **JWT đang TẮT** (giai đoạn test API trực tiếp). Hiện truyền `userId`/`role` qua param. Thiết kế tầng `AuthRepository` + interceptor sẵn sàng gắn `Authorization: Bearer` khi backend bật JWT — **không** hard-code giả định "không có token".
7. **Subscription KHÔNG gate tính năng** ở codebase hiện tại — đừng khoá màn theo gói.
8. **Không có websocket** — live chat & unread dùng polling (4–6s) hoặc pull-to-refresh; thiết kế để dễ swap sang realtime sau.

---

## 12. Domain Status → UI Mapping

Dùng `StatusPill` ([§5.3]). Map enum backend → màu + nhãn tiếng Việt:

**QuestionEscalation.status**
| Value | Màu | Nhãn |
|---|---|---|
| `PENDING_OFFER` | warning | Đang tìm người hỗ trợ |
| `OFFERED` | info | Đã đề xuất mentor |
| `IN_CHAT` | primary | Đang trò chuyện |
| `COMPLETED` | success | Đã hoàn tất |
| `CANCELLED` | neutral (`warm500`) | Đã huỷ |

**AssignmentSubmission.status** (+ derived) — `SUBMITTED`→info "Đã nộp", `REVIEWED`→success "Đã chấm", *chưa nộp*→`warm500` "Chưa nộp", *quá hạn chưa nộp*→error "Trễ hạn".

**KnowledgeCandidate.status** — `PENDING_SENIOR_REVIEW`→warning "Chờ Senior duyệt", `INDEXED`→success "Đã vào AI", `REJECTED`→error "Bị từ chối".

**AiAnswerReview.status** — `SUBMITTED`→info "Đã ghi nhận", `NEEDS_MENTOR_REVIEW`→warning "Chờ mentor", `NEEDS_SENIOR_REVIEW`→peacockBlue "Chờ Senior", `RESOLVED`→success "Đã xử lý".

**ChatRoom.status** — `ACTIVE`→success (dot xanh) "Đang mở", `CLOSED`→`warm500` "Đã đóng", `ENDED`→`warm700` "Kết thúc".

**ImprovePlan.riskLevel** — `HIGH`→error "Rủi ro cao", `MEDIUM`→warning "Trung bình", `LOW`→success "Ổn định".

**ClassSection/Enrollment.status** — `ACTIVE`→primary "Đang học", `COMPLETED`→`warm500` "Đã hoàn thành".

**Payment.status** — `PENDING`→warning, `SUCCESS`→success, `FAILED`→error.

> Tạo 1 helper `statusStyleFor(domain, value)` trả `(Color fg, Color bg, String label)` để không rải switch khắp nơi.

---

## 13. Accessibility, i18n & Performance

- **Contrast:** mọi text ≥ AA. Cam `#F37021` trên trắng **không** đạt AA cho text nhỏ → dùng `primaryDark` cho text cam; cam chỉ làm nền nút (với text trắng) hoặc dấu nhấn lớn.
- **Touch target:** ≥ 44×44. **Tap area** ≥ visual qua padding.
- **Semantics:** `Semantics(label:)` cho icon-only; `excludeSemantics` cho trang trí. Hỗ trợ screen reader tiếng Việt.
- **Text scale:** layout không vỡ ở `textScaleFactor` 1.3. Dùng `Flexible`/`Wrap`, tránh height cố định cho text.
- **i18n:** `flutter_localizations` + ARB, mặc định `vi`, thêm `en`. Không hard-code chuỗi trong widget. Format ngày kiểu VN (`dd/MM/yyyy`, "2 giờ trước").
- **Reduced motion:** xem [§2.5].
- **Performance:** `const` widget tối đa; `ListView.builder` + `cached_network_image`; skeleton thay spinner; tránh rebuild toàn cây (Riverpod `select`). Ảnh/PDF lazy-load.

---

## 14. Roadmap triển khai

**Phase 0 — Foundation (làm trước tiên):**
1. `pubspec.yaml` thêm deps ([§5]/[§6]). 2. `lib/core/theme/*` (tokens + theme). 3. `assets/images/` logo + fonts config. 4. Shared widgets ([§5]) + state widgets. 5. `dio_client` + `env.dart` + `app_router` + auth shell.

**Phase 1 — Student core:** Auth → Home → Course/Materials → **AI Tutor chat + review** → Code Mentor → Assignments (submit) → Improve plan.

**Phase 2 — Escalation & live chat:** Offer/mentor-matching → live chat (polling) → escalation history.

**Phase 3 — Teacher:** Dashboard → Classes/Roster → Assignment manage + chấm → Inbox + answer (+ knowledge candidate) → mentor-review queue.

**Phase 4 — Senior/Admin & polish:** Senior queues + candidate approval → notifications → dark mode → subscription (optional) → a11y/i18n pass.

**Definition of Done mỗi màn:** đủ 4 state · token đúng (không hex lạ) · ≥1 micro-interaction · pass [§3] checklist · responsive textScale 1.3 · không màu Material default.

---

## 15. Appendix — Full API Reference

> Base: `http://<host>:8085`. `consumedBy` = persona dùng. (★ = đi qua n8n webhook trong AI flow.)

### Auth / User
| Method | Path | Persona | Ghi chú |
|---|---|---|---|
| POST | `/api/users/register` | Student | email, password, fullName, phone → userId, token |
| POST | `/api/users/login` | Student/Teacher | → userId, role, fullName, avatarUrl, token |
| GET | `/api/users/{userId}/profile` | All | profile đầy đủ |
| PUT | `/api/users/{userId}/profile` | All | fullName, phone, avatarUrl, bio, address, city |

### Academic (Student/Teacher đọc; Admin ghi)
| Method | Path | Persona |
|---|---|---|
| GET | `/api/students/{studentId}/courses` | Student |
| GET | `/api/mentors/{teacherId}/courses` | Teacher |
| GET | `/api/mentors/{teacherId}/class-sections` | Teacher |
| GET | `/api/courses/{courseId}/class-sections` | Teacher |
| GET | `/api/courses/{courseId}/class-sections/{classId}/students?teacherId` | Teacher |
| GET | `/api/courses?semesterId` | All |

### Course Materials / RAG
| Method | Path | Persona |
|---|---|---|
| POST | `/api/courses/{courseId}/materials/upload` (multipart: file, title, teacherId, classId?) | Teacher |
| GET | `/api/courses/{courseId}/materials` | Student |
| GET | `/api/courses/{courseId}/materials/{materialId}/pdf` | Student |
| POST | `/api/courses/{courseId}/materials/{materialId}/reindex?teacherId` | Teacher |
| DELETE | `/api/courses/{courseId}/materials/{materialId}?teacherId` | Teacher |

### AI Tutor / Code Mentor / Conversations / Memory
| Method | Path | Persona |
|---|---|---|
| POST | `/api/tutor/intent-classify` | N8N |
| POST ★ | `/api/ai/query?userId&userName&userEmail` | Student | body: message, courseId, classId, conversationId → mode, answer, confidence, escalated, conversationId, questionEscalationId, sources |
| POST | `/api/code-mentor/query` | Student | studentId, courseId, classId, question, code, language, assignmentRelated, conversationId |
| POST | `/api/code-mentor/upload` (multipart) | Student |
| GET | `/api/ai/conversations?userId&page&size` | Student |
| POST | `/api/ai/conversations?userId` | Student |
| GET | `/api/ai/conversations/{conversationId}/messages?userId` | Student |
| PATCH | `/api/ai/conversations/{conversationId}` | Student | rename |
| DELETE | `/api/ai/conversations/{conversationId}?userId` | Student |
| GET | `/api/tutor/students/{studentId}/courses/{courseId}/memory` | Student |
| PUT | `/api/tutor/students/{studentId}/courses/{courseId}/memory` | Student |
| GET | `/api/tutor/courses/{courseId}/memories?classId` | Teacher |
| POST | `/api/tutor/improve-suggestions` | Student |
| GET | `/api/students/{studentId}/improve-plans?courseId` | Student |
| GET | `/api/students/{studentId}/courses/{courseId}/improve-plan` | Student |
| PUT | `/api/improve-plans/{planId}/complete` | Student |

### Escalation / Live Chat
| Method | Path | Persona |
|---|---|---|
| POST | `/api/tutor/escalations` | N8N |
| POST | `/api/tutor/escalations/offer?questionEscalationId` | Student |
| POST | `/api/tutor/escalations/select` | Student | userId, questionEscalationId, selectedMentorId → chatRoomId |
| POST | `/api/tutor/escalations/cancel` | Student |
| GET | `/api/tutor/escalations/history?userId` | Student |
| POST ★ | `/api/tutor/escalations/{id}/answer` | Teacher | teacherId, answer, createKnowledgeCandidate, candidateType |
| GET | `/api/tutor/escalations/teachers/{teacherId}?status` | Teacher |
| POST | `/api/chat/send` | Student/Mentor |
| GET | `/api/chat/history?chatRoomId&page&size` | Student/Mentor |
| GET | `/api/chat/detail?chatRoomId` | Student/Mentor |
| POST | `/api/chat/mark-read` | Student/Mentor |
| POST | `/api/chat/close` | Student | userRating, userFeedback |
| GET | `/api/chat/unread?userId&role` | Student/Mentor |

### Answer Review / Knowledge (AI learning gate)
| Method | Path | Persona |
|---|---|---|
| POST ★ | `/api/tutor/answer-reviews` | Student | reviewType, accurate, helpful, rating, suggestedCorrection, reviewerRole |
| GET | `/api/tutor/answer-reviews/mentor-pending?courseId` | Mentor |
| GET | `/api/tutor/answer-reviews/senior-pending?courseId` | Senior |
| POST | `/api/tutor/answer-reviews/{id}/senior-resolve` | Senior | decision, candidateType, correctedAnswer |
| GET | `/api/tutor/knowledge-candidates/senior-pending?teacherId&courseId` | Senior |
| POST ★ | `/api/tutor/knowledge-candidates/{id}/approve` | Senior | reviewerId, reviewerRole, reviewerName, reviewNote |
| POST ★ | `/api/tutor/knowledge-candidates/{id}/reject` | Senior | rejectionReason |

### Assignment
| Method | Path | Persona |
|---|---|---|
| POST | `/api/mentor/courses/{courseId}/classes/{classId}/assignments/upload` (multipart) | Teacher |
| GET | `/api/mentor/courses/{courseId}/classes/{classId}/assignments?teacherId` | Teacher |
| GET | `/api/mentor/assignments/{assignmentId}/submissions?teacherId` | Teacher |
| PUT | `/api/mentor/submissions/{submissionId}/review` | Teacher | score, teacherFeedback, weakTopics |
| GET | `/api/students/{studentId}/assignments?courseId` | Student |
| GET | `/api/students/{studentId}/submissions?courseId` | Student |
| POST | `/api/students/assignments/{assignmentId}/submit` (multipart) | Student |
| GET | `/api/assignments/{assignmentId}/file` | All |
| GET | `/api/submissions/{submissionId}/file` | Teacher |

### Dashboards
| Method | Path | Persona |
|---|---|---|
| GET | `/api/students/{studentId}/dashboard?courseId&requesterId&requesterRole` | Student |
| GET | `/api/mentors/{teacherId}/dashboard?courseId&classId&requesterId&requesterRole` | Teacher |
| GET | `/api/mentors/{teacherId}/escalations/inbox?status&requesterId&requesterRole` | Teacher |

### Mentors (cho mentor matching)
| Method | Path | Persona |
|---|---|---|
| GET | `/api/mentors?category&specialization&minRating` | Student |
| GET | `/api/mentors/{id}` | Student |

### Payment / Subscription (Phase 2, không gate tính năng)
| Method | Path | Persona |
|---|---|---|
| POST | `/api/payments` | Student |
| GET | `/api/payments/{paymentId}` | Student |
| GET | `/api/payments/user/{userId}` | Student |

> Admin endpoints (`/api/admin/*`, import Excel, semester/course CRUD, subscription back office) chủ yếu cho **web admin** — không nằm trong app mobile phase 1–3. Xem source nếu cần.

---

*Tài liệu này phản ánh backend tại thời điểm khảo sát (package `com.ragapi`, JWT off, không có websocket, không feature-gate theo subscription). Khi backend đổi (bật JWT, thêm notification/websocket), cập nhật [§11] tương ứng.*
