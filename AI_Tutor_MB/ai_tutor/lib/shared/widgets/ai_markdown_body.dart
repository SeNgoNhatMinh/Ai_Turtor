import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:markdown/markdown.dart' as md;

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/ai_study_tips.dart';
import 'ai_study_path_widgets.dart';
import 'ai_suggestion_json.dart';
import 'markdown_code_block.dart';

final _aiMarkdownExtensions = md.ExtensionSet(
  const [md.FencedCodeBlockSyntax(), md.TableSyntax()],
  [md.StrikethroughSyntax(), md.AutolinkExtensionSyntax()],
);

/// Markdown cho câu trả lời AI — headings, lists, code blocks, link gợi ý học.
class AiMarkdownBody extends StatefulWidget {
  const AiMarkdownBody({super.key, required this.data, this.onStudyTipTap});

  final String data;
  final ValueChanged<String>? onStudyTipTap;

  static const Color _studyTipColor = AppColors.studyTipLink;

  @override
  State<AiMarkdownBody> createState() => _AiMarkdownBodyState();
}

class _AiMarkdownBodyState extends State<AiMarkdownBody>
    implements MarkdownBuilderDelegate {
  List<Widget>? _children;
  var _failed = false;
  var _plain = '';
  final _recognizers = <GestureRecognizer>[];

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _parse();
  }

  @override
  void didUpdateWidget(covariant AiMarkdownBody oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.data != widget.data ||
        (oldWidget.onStudyTipTap == null) != (widget.onStudyTipTap == null)) {
      _parse();
    }
  }

  @override
  void dispose() {
    _disposeRecognizers();
    super.dispose();
  }

  void _parse() {
    _disposeRecognizers();
    _failed = false;
    _children = null;
    final segments = splitStudyPathSegments(widget.data);
    _plain = widget.data;
    try {
      final children = <Widget>[];
      for (final segment in segments) {
        if (segment.isStudy) {
          if (segment.isNextLessonHeading) continue;
          children.add(
            AiStudyPathBlock(
              heading: segment.heading,
              tips: segment.tips,
              isNextLessonHeading: segment.isNextLessonHeading,
              onStudyTipTap: widget.onStudyTipTap,
            ),
          );
          continue;
        }
        children.addAll(_parseMarkdown(segment.markdown));
      }
      _children = children;
    } catch (_) {
      _failed = true;
      _children = null;
    }
  }

  List<Widget> _parseMarkdown(String raw) {
    final markdown = stabilizeAiMarkdown(_enhanceInteractiveStudyLinks(raw));
    if (markdown.trim().isEmpty) return const [];
    final document = md.Document(
      extensionSet: _aiMarkdownExtensions,
      encodeHtml: false,
    );
    final nodes = document.parseLines(const LineSplitter().convert(markdown));
    final styleSheet = MarkdownStyleSheet.fromTheme(
      Theme.of(context),
    ).merge(_styleSheet(Theme.of(context)));
    final builder = MarkdownBuilder(
      delegate: this,
      selectable: false,
      styleSheet: styleSheet,
      imageDirectory: null,
      sizedImageBuilder: (config) => _SafeMarkdownImage(config: config),
      checkboxBuilder: null,
      bulletBuilder: null,
      builders: {'pre': _ChatGptCodeBlockBuilder()},
      paddingBuilders: const {},
      fitContent: true,
      listItemCrossAxisAlignment: MarkdownListItemCrossAxisAlignment.start,
    );
    return builder.build(nodes);
  }

  void _disposeRecognizers() {
    for (final recognizer in _recognizers) {
      recognizer.dispose();
    }
    _recognizers.clear();
  }

  MarkdownStyleSheet _styleSheet(ThemeData theme) {
    final prose = theme.textTheme.bodyLarge?.copyWith(
      color: AppColors.textPrimary,
      fontSize: 15.5,
      height: 1.75,
    );
    return MarkdownStyleSheet(
      p: prose,
      pPadding: const EdgeInsets.only(bottom: 2),
      h1: theme.textTheme.titleMedium?.copyWith(
        fontSize: 18,
        fontWeight: FontWeight.w800,
        height: 1.35,
        letterSpacing: -0.2,
        color: AppColors.textPrimary,
      ),
      h2: theme.textTheme.titleMedium?.copyWith(
        fontSize: 17,
        fontWeight: FontWeight.w800,
        height: 1.4,
        letterSpacing: -0.15,
        color: AppColors.textPrimary,
      ),
      h3: theme.textTheme.titleSmall?.copyWith(
        fontSize: 15.5,
        fontWeight: FontWeight.w800,
        height: 1.4,
        color: AppColors.textPrimary,
      ),
      h1Padding: const EdgeInsets.only(top: 16, bottom: 2),
      h2Padding: const EdgeInsets.only(top: 16, bottom: 2),
      h3Padding: const EdgeInsets.only(top: 12, bottom: 2),
      listBullet: prose?.copyWith(
        color: AppColors.primary,
        fontWeight: FontWeight.w700,
      ),
      listIndent: 25,
      listBulletPadding: const EdgeInsets.only(right: 8),
      blockSpacing: 10,
      strong: prose?.copyWith(
        fontWeight: FontWeight.w800,
        color: AppColors.textPrimary,
      ),
      em: prose?.copyWith(color: AppColors.textSecondary),
      a: prose?.copyWith(
        color: AiMarkdownBody._studyTipColor,
        fontWeight: FontWeight.w700,
        decoration: TextDecoration.underline,
        decorationColor: AiMarkdownBody._studyTipColor,
      ),
      code: codeStyle().copyWith(
        fontSize: 13.5,
        height: 1.45,
        color: const Color(0xFFB54708),
        backgroundColor: const Color(0xFFF7F7F5),
      ),
      codeblockPadding: EdgeInsets.zero,
      codeblockDecoration: const BoxDecoration(color: Colors.transparent),
      blockquote: prose?.copyWith(color: AppColors.textSecondary, height: 1.6),
      blockquotePadding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
      blockquoteDecoration: const BoxDecoration(
        color: AppColors.raised,
        border: Border(left: BorderSide(color: AppColors.primary, width: 3)),
      ),
      horizontalRuleDecoration: const BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.borderHairline)),
      ),
    );
  }

  @override
  GestureRecognizer createLink(String text, String? href, String title) {
    final recognizer = TapGestureRecognizer()
      ..onTap = () {
        if (widget.onStudyTipTap == null || !isStudyTipHref(href)) return;
        final label = text.trim();
        if (label.isEmpty) return;
        widget.onStudyTipTap!(label);
      };
    _recognizers.add(recognizer);
    return recognizer;
  }

  @override
  TextSpan formatText(MarkdownStyleSheet styleSheet, String code) {
    return TextSpan(
      style: styleSheet.code,
      text: code.replaceAll(RegExp(r'\n$'), ''),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_failed || _children == null) {
      return SelectableText(
        _plain.trim().isEmpty ? ' ' : _plain,
        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
          color: AppColors.textPrimary,
          height: 1.55,
        ),
      );
    }
    final children = _children!;
    if (children.length == 1) return children.single;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: children,
    );
  }
}

class _ChatGptCodeBlockBuilder extends MarkdownElementBuilder {
  @override
  Widget? visitElementAfter(md.Element element, TextStyle? preferredStyle) {
    md.Element? codeElement;
    for (final child in element.children ?? const []) {
      if (child is md.Element && child.tag == 'code') {
        codeElement = child;
        break;
      }
    }
    final source = codeElement ?? element;
    final language = (source.attributes['class'] ?? '')
        .replaceFirst(RegExp(r'^language-'), '')
        .trim();
    final code = source.textContent;
    if (code.trim().isEmpty) return const SizedBox.shrink();
    return MarkdownCodeBlock(
      code: code,
      language: language.isEmpty ? null : language,
    );
  }
}

const _interactiveStudyHeadings = <String>{
  'lưu ý',
  'lưu ý để học tốt hơn',
  'bài tiếp theo',
  'bài tập tiếp theo',
  'bài kế tiếp',
  'học tiếp phần này',
  'học chuyên sâu',
};

const _extractedStudyHeadings = <String>{
  'bài tiếp theo',
  'bài tập tiếp theo',
  'bài kế tiếp',
  'học tiếp phần này',
  'học chuyên sâu',
};

const _nextLessonHeadings = <String>{
  'bài tiếp theo',
  'bài tập tiếp theo',
  'bài kế tiếp',
};

class StudyPathSegment {
  const StudyPathSegment.markdown(this.markdown)
    : heading = '',
      tips = const [],
      isNextLessonHeading = false;

  const StudyPathSegment.study({
    required this.heading,
    required this.tips,
    required this.isNextLessonHeading,
  }) : markdown = '';

  final String markdown;
  final String heading;
  final List<String> tips;
  final bool isNextLessonHeading;

  bool get isStudy => heading.isNotEmpty;
}

final _markdownSectionHeading = RegExp(r'^#{1,6}\s+\S');

String _unwrapStudyHeading(String line) {
  var body = line.trim().replaceFirst(RegExp(r'^#{1,6}\s*'), '');
  body = body
      .replaceFirstMapped(RegExp(r'^\*\*(.+)\*\*$'), (match) => match[1] ?? '')
      .replaceFirstMapped(RegExp(r'^__(.+)__$'), (match) => match[1] ?? '')
      .replaceFirstMapped(RegExp(r'^`(.+)`$'), (match) => match[1] ?? '')
      .replaceFirst(RegExp(r'\s*[:：]\s*$'), '')
      .trim();
  return body;
}

bool _isInteractiveStudyHeadingLine(String line) {
  final plain = _unwrapStudyHeading(line).toLowerCase();
  return plain.isNotEmpty &&
      plain.length <= 90 &&
      (_interactiveStudyHeadings.contains(plain) || plain.startsWith('lưu ý'));
}

bool _isExtractedStudyHeadingLine(String line) {
  final plain = _unwrapStudyHeading(line).toLowerCase();
  return _extractedStudyHeadings.contains(plain);
}

String _unwrapStudyTipLabel(String raw) {
  var label = raw.trim();
  label = label
      .replaceFirst(RegExp(r'^[-*+]\s+'), '')
      .replaceFirst(RegExp(r'^\d+[.)]\s+'), '')
      .replaceFirstMapped(
        RegExp(r'^\[([^\]]+)\]\([^)]+\)$'),
        (match) => match[1] ?? '',
      )
      .replaceAll(RegExp(r'[*_`]+'), '')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
  return label;
}

@visibleForTesting
List<StudyPathSegment> splitStudyPathSegments(String input) {
  final lines = input.replaceAll('\r\n', '\n').split('\n');
  final segments = <StudyPathSegment>[];
  final markdown = <String>[];
  var heading = '';
  var isNextLesson = false;
  final tips = <String>[];

  void flushMarkdown() {
    final text = markdown.join('\n').trimRight();
    if (text.trim().isNotEmpty) {
      segments.add(StudyPathSegment.markdown(text));
    }
    markdown.clear();
  }

  void flushStudy() {
    if (heading.isNotEmpty && tips.isNotEmpty) {
      segments.add(
        StudyPathSegment.study(
          heading: heading,
          tips: List<String>.from(tips),
          isNextLessonHeading: isNextLesson,
        ),
      );
    }
    heading = '';
    isNextLesson = false;
    tips.clear();
  }

  for (final line in lines) {
    final trimmed = line.trim();
    if (_isExtractedStudyHeadingLine(trimmed)) {
      flushMarkdown();
      flushStudy();
      heading = _unwrapStudyHeading(trimmed);
      isNextLesson = _nextLessonHeadings.contains(heading.toLowerCase());
      continue;
    }
    if (heading.isNotEmpty && _markdownSectionHeading.hasMatch(trimmed)) {
      flushStudy();
      markdown.add(line);
      continue;
    }
    if (heading.isNotEmpty) {
      if (trimmed.isEmpty) continue;
      final label = _unwrapStudyTipLabel(trimmed);
      if (label.isEmpty) continue;
      tips.add(label);
      continue;
    }
    markdown.add(line);
  }
  flushMarkdown();
  flushStudy();
  if (segments.isEmpty && input.trim().isNotEmpty) {
    return [StudyPathSegment.markdown(input)];
  }
  return segments;
}

List<String> nextLessonTipsForAnswer(String? answer) {
  for (final segment in splitStudyPathSegments(answer ?? '')) {
    if (!segment.isNextLessonHeading) continue;
    for (final tip in segment.tips) {
      if (tip.trim().isEmpty) continue;
      return [tip.trim()];
    }
  }
  return const [];
}

/// Biến các lựa chọn học tiếp thành link nội bộ để dùng lại callback học
/// theo môn đang được chọn của màn chat.
@visibleForTesting
String enhanceInteractiveStudyLinks(String input) {
  return _enhanceInteractiveStudyLinks(input);
}

String _enhanceInteractiveStudyLinks(String input) {
  final lines = input.replaceAll('\r\n', '\n').split('\n');
  final output = <String>[];
  var inInteractiveSection = false;
  var linkIndex = 1;

  for (final line in lines) {
    final trimmed = line.trim();
    if (_isInteractiveStudyHeadingLine(trimmed)) {
      inInteractiveSection = true;
      output.add(line);
      continue;
    }

    if (inInteractiveSection && _markdownSectionHeading.hasMatch(trimmed)) {
      inInteractiveSection = false;
      output.add(line);
      continue;
    }

    if (!inInteractiveSection || trimmed.isEmpty || _hasMarkdownLink(trimmed)) {
      output.add(line);
      continue;
    }

    final bullet = RegExp(r'^(\s*[-*+]\s+)(.+)$').firstMatch(line);
    final ordered = RegExp(r'^(\s*\d+[.)]\s+)(.+)$').firstMatch(line);
    final match = bullet ?? ordered;
    final label = (match?.group(2) ?? trimmed).trim();
    if (label.isEmpty) {
      if (match != null) output.add(line);
      continue;
    }
    final escaped = label.replaceAll('[', r'\[').replaceAll(']', r'\]');
    final link = '[$escaped](#ai-study-tip-section-${linkIndex++})';
    output.add(match == null ? '- $link' : '${match.group(1)}$link');
  }

  return output.join('\n');
}

bool _hasMarkdownLink(String text) {
  return RegExp(r'\[[^\]]+\]\([^)]+\)').hasMatch(text);
}

/// Cắt markdown theo index reveal mà không để dở `**`, link hay fence.
String sliceMarkdownForReveal(String full, int index) {
  if (index <= 0) return '';
  if (index >= full.length) return full;
  var slice = full.substring(0, index);
  if (!hasUnclosedMarkdownInlines(slice)) return slice;
  final lastBreak = slice.lastIndexOf('\n');
  if (lastBreak <= 0) return '';
  return slice.substring(0, lastBreak);
}

/// Đóng markup dở và bỏ HTML thô để flutter_markdown không assert `_inlines`.
String stabilizeAiMarkdown(String input) {
  var text = rewriteSuggestionJson(input.replaceAll('\r\n', '\n'));
  if (text.trim().isEmpty) return text;
  text = text.replaceAll(RegExp(r'</?[a-zA-Z][^>]*>'), '');

  final fenceCount = RegExp(
    r'^ {0,3}(```|~~~)',
    multiLine: true,
  ).allMatches(text).length;
  if (fenceCount.isOdd) {
    text = '$text\n```';
  }

  text = text.replaceFirst(RegExp(r'!?\[[^\]]*\]\([^)]*$'), '');
  text = text.replaceFirst(RegExp(r'!?\[[^\]]*$'), '');

  if (_countToken(text, '**').isOdd) {
    text = '$text**';
  }
  if (_countToken(text, '__').isOdd) {
    text = '${text}__';
  }
  return text;
}

bool hasUnclosedMarkdownInlines(String text) {
  final fenceCount = RegExp(
    r'^ {0,3}(```|~~~)',
    multiLine: true,
  ).allMatches(text).length;
  if (fenceCount.isOdd) return true;
  if (RegExp(r'!?\[[^\]]*$').hasMatch(text)) return true;
  if (RegExp(r'!?\[[^\]]*\]\([^)]*$').hasMatch(text)) return true;
  if (_countToken(text, '**').isOdd) return true;
  if (_countToken(text, '__').isOdd) return true;
  return false;
}

int _countToken(String text, String token) {
  var count = 0;
  var from = 0;
  while (true) {
    final index = text.indexOf(token, from);
    if (index < 0) return count;
    count += 1;
    from = index + token.length;
  }
}

class _SafeMarkdownImage extends StatelessWidget {
  const _SafeMarkdownImage({required this.config});

  final MarkdownImageConfig config;

  @override
  Widget build(BuildContext context) {
    final uri = config.uri;
    const fallback = Icon(
      Icons.broken_image_outlined,
      size: 28,
      color: AppColors.textTertiary,
    );
    Widget image;
    if (uri.scheme == 'http' || uri.scheme == 'https') {
      image = Image.network(
        uri.toString(),
        width: config.width,
        height: config.height,
        fit: BoxFit.contain,
        errorBuilder: (_, __, ___) => fallback,
      );
    } else if (uri.scheme == 'asset' || uri.scheme.isEmpty) {
      final path = uri.scheme == 'asset' ? uri.path : uri.toString();
      image = Image.asset(
        path,
        width: config.width,
        height: config.height,
        fit: BoxFit.contain,
        errorBuilder: (_, __, ___) => fallback,
      );
    } else {
      image = fallback;
    }

    return ConstrainedBox(
      constraints: BoxConstraints(
        maxWidth: config.width ?? 280,
        maxHeight: config.height ?? 180,
      ),
      child: image,
    );
  }
}
