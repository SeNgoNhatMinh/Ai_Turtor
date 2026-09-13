import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:markdown/markdown.dart' as md;

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/ai_study_tips.dart';
import 'markdown_code_block.dart';

/// Markdown cho câu trả lời AI — headings, lists, code blocks, link gợi ý học.
class AiMarkdownBody extends StatelessWidget {
  const AiMarkdownBody({
    super.key,
    required this.data,
    this.onStudyTipTap,
  });

  final String data;
  final ValueChanged<String>? onStudyTipTap;

  static const Color _studyTipColor = Color(0xFFB94F12);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return MarkdownBody(
      data: data,
      shrinkWrap: true,
      selectable: true,
      builders: {
        'pre': _CodePreBuilder(),
        'a': _StudyTipLinkBuilder(onStudyTipTap: onStudyTipTap),
      },
      styleSheet: MarkdownStyleSheet(
        p: theme.textTheme.bodyLarge?.copyWith(
          color: AppColors.textPrimary,
          height: 1.55,
        ),
        h1: theme.textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w700,
          color: AppColors.textPrimary,
        ),
        h2: theme.textTheme.titleMedium?.copyWith(
          fontWeight: FontWeight.w700,
          color: AppColors.splashNavy,
        ),
        h3: theme.textTheme.titleSmall?.copyWith(
          fontWeight: FontWeight.w600,
          color: AppColors.textPrimary,
        ),
        h1Padding: const EdgeInsets.only(top: Insets.sm, bottom: Insets.xs),
        h2Padding: const EdgeInsets.only(top: Insets.md, bottom: Insets.xs),
        h3Padding: const EdgeInsets.only(top: Insets.sm, bottom: Insets.xs),
        listBullet: theme.textTheme.bodyLarge?.copyWith(
          color: AppColors.primary,
        ),
        listIndent: 20,
        blockSpacing: Insets.sm,
        strong: theme.textTheme.bodyLarge?.copyWith(
          fontWeight: FontWeight.w700,
          color: AppColors.textPrimary,
        ),
        a: theme.textTheme.bodyLarge?.copyWith(
          color: AppColors.textPrimary,
          decoration: TextDecoration.none,
        ),
        code: codeStyle().copyWith(
          fontSize: 13,
          color: AppColors.peacockBlue,
          backgroundColor: AppColors.raised,
        ),
        codeblockPadding: EdgeInsets.zero,
        codeblockDecoration: const BoxDecoration(color: Colors.transparent),
      ),
    );
  }
}

class _StudyTipLinkBuilder extends MarkdownElementBuilder {
  _StudyTipLinkBuilder({this.onStudyTipTap});

  final ValueChanged<String>? onStudyTipTap;

  @override
  bool visitElementBefore(md.Element element) {
    return !isStudyTipHref(element.attributes['href']);
  }

  @override
  Widget? visitElementAfter(md.Element element, TextStyle? preferredStyle) {
    final href = element.attributes['href'];
    if (!isStudyTipHref(href)) return null;

    final label = element.textContent.trim();
    if (label.isEmpty) return null;

    return _StudyTipLink(
      label: label,
      baseStyle: preferredStyle,
      onTap: onStudyTipTap == null ? null : () => onStudyTipTap!(label),
    );
  }
}

class _StudyTipLink extends StatefulWidget {
  const _StudyTipLink({
    required this.label,
    required this.baseStyle,
    this.onTap,
  });

  final String label;
  final TextStyle? baseStyle;
  final VoidCallback? onTap;

  @override
  State<_StudyTipLink> createState() => _StudyTipLinkState();
}

class _StudyTipLinkState extends State<_StudyTipLink> {
  bool _hovered = false;
  bool _pressed = false;

  bool get _active => _hovered || _pressed;

  @override
  Widget build(BuildContext context) {
    final base = widget.baseStyle ?? const TextStyle();
    final activeStyle = base.copyWith(
      color: _active
          ? AiMarkdownBody._studyTipColor
          : AppColors.textPrimary,
      decoration: _active ? TextDecoration.underline : TextDecoration.none,
      decorationColor: AiMarkdownBody._studyTipColor,
      height: 1.55,
    );

    return MouseRegion(
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      cursor: widget.onTap == null
          ? SystemMouseCursors.basic
          : SystemMouseCursors.click,
      child: GestureDetector(
        onTap: widget.onTap,
        onTapDown: widget.onTap == null
            ? null
            : (_) => setState(() => _pressed = true),
        onTapUp: widget.onTap == null
            ? null
            : (_) => setState(() => _pressed = false),
        onTapCancel: widget.onTap == null
            ? null
            : () => setState(() => _pressed = false),
        child: Text(widget.label, style: activeStyle),
      ),
    );
  }
}

class _CodePreBuilder extends MarkdownElementBuilder {
  @override
  Widget? visitElementAfter(md.Element element, TextStyle? preferredStyle) {
    if (element.tag != 'pre') return null;

    String? language;
    var code = '';

    final child = element.children?.isNotEmpty == true
        ? element.children!.first
        : null;
    if (child is md.Element && child.tag == 'code') {
      final cls = child.attributes['class'] ?? '';
      if (cls.startsWith('language-')) {
        language = cls.substring('language-'.length);
      }
      code = child.textContent;
    } else {
      code = element.textContent;
    }

    if (code.trim().isEmpty) return const SizedBox.shrink();

    return MarkdownCodeBlock(code: code, language: language);
  }
}
