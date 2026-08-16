import 'package:flutter/material.dart';

/// Shared TextField settings for Vietnamese IME keyboards (Gboard, Zalo, Samsung…).
///
/// Do not use Telex/VNI input formatters here — they fight OS composition and
/// strip diacritics. Backend expects UTF-8 with full Vietnamese characters.
class VietnameseTextInput {
  const VietnameseTextInput._();

  static const autocorrect = true;
  static const enableSuggestions = true;
  static const enableIMEPersonalizedLearning = true;
  static const textCapitalization = TextCapitalization.sentences;
  static const smartDashesType = SmartDashesType.disabled;
  static const smartQuotesType = SmartQuotesType.disabled;

  /// Plain multiline chat / feedback — preserve user text as typed.
  static TextInputType keyboardForMultiline(int maxLines) =>
      maxLines > 1 ? TextInputType.multiline : TextInputType.text;
}
