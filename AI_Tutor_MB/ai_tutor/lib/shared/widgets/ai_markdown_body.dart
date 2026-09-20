import 'dart:convert';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:markdown/markdown.dart' as md;

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_typography.dart';
import '../../core/utils/ai_study_tips.dart';
import 'ai_suggestion_json.dart';

final _aiMarkdownExtensions = md.ExtensionSet(
  const [md.FencedCodeBlockSyntax(), md.TableSyntax()],
  [md.StrikethroughSyntax(), md.AutolinkExtensionSyntax()],
);

/// Markdown cho câu trả lời AI — headings, lists, code blocks, link gợi ý học.
class AiMarkdownBody extends StatefulWidget {
  const AiMarkdownBody({super.key, required this.data, this.onStudyTipTap});

  final String data;
  final ValueChanged<String>? onStudyTipTap;

  static const Color _studyTipColor = Color(0xFFB94F12);

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
    if (oldWidget.data != widget.data) {
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
    final markdown = stabilizeAiMarkdown(widget.data);
    _plain = markdown;
    try {
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
        builders: const {},
        paddingBuilders: const {},
        fitContent: true,
        listItemCrossAxisAlignment: MarkdownListItemCrossAxisAlignment.start,
      );
      _children = builder.build(nodes);
    } catch (_) {
      _failed = true;
      _children = null;
    }
  }

  void _disposeRecognizers() {
    for (final recognizer in _recognizers) {
      recognizer.dispose();
    }
    _recognizers.clear();
  }

  MarkdownStyleSheet _styleSheet(ThemeData theme) {
    return MarkdownStyleSheet(
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
      listBullet: theme.textTheme.bodyLarge?.copyWith(color: AppColors.primary),
      listIndent: 20,
      blockSpacing: Insets.sm,
      strong: theme.textTheme.bodyLarge?.copyWith(
        fontWeight: FontWeight.w700,
        color: AppColors.textPrimary,
      ),
      a: theme.textTheme.bodyLarge?.copyWith(
        color: AiMarkdownBody._studyTipColor,
        decoration: TextDecoration.underline,
        decorationColor: AiMarkdownBody._studyTipColor,
      ),
      code: codeStyle().copyWith(
        fontSize: 13,
        color: AppColors.peacockBlue,
        backgroundColor: AppColors.raised,
      ),
      codeblockPadding: EdgeInsets.zero,
      codeblockDecoration: const BoxDecoration(color: Colors.transparent),
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
