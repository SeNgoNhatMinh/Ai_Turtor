import 'package:ai_tutor/core/theme/app_colors.dart';
import 'package:ai_tutor/core/theme/student_web_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('student light theme uses the web workspace palette', () {
    final theme = buildStudentWebTheme(ThemeData.light());

    expect(theme.scaffoldBackgroundColor, AppColors.studentCanvas);
    expect(theme.colorScheme.primary, AppColors.studentBlue);
    expect(theme.colorScheme.surface, AppColors.studentSurface);
    expect(theme.colorScheme.onSurface, AppColors.studentText);
    expect(theme.colorScheme.outline, AppColors.studentBorder);
  });

  test('student dark theme keeps its dedicated dark surfaces', () {
    final theme = buildStudentWebTheme(ThemeData.dark());

    expect(theme.scaffoldBackgroundColor, const Color(0xFF000000));
    expect(theme.colorScheme.surface, const Color(0xFF171717));
    expect(theme.colorScheme.onSurface, const Color(0xFFF9FAFB));
    expect(theme.colorScheme.primary, AppColors.studentBlue);
  });
}
