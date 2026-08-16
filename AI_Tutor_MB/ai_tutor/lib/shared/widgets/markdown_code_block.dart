import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_highlight/flutter_highlight.dart';
import 'package:gap/gap.dart';
import 'package:highlight/highlight.dart' show highlight;
import 'package:highlight/languages/dart.dart' as lang_dart;
import 'package:highlight/languages/java.dart' as lang_java;
import 'package:highlight/languages/javascript.dart' as lang_js;
import 'package:highlight/languages/python.dart' as lang_python;
import 'package:highlight/languages/sql.dart' as lang_sql;
import 'package:highlight/languages/xml.dart' as lang_xml;
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/theme/app_radius.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_typography.dart';

bool _highlightLanguagesRegistered = false;

void _ensureHighlightLanguages() {
  if (_highlightLanguagesRegistered) return;
  highlight.registerLanguage('dart', lang_dart.dart);
  highlight.registerLanguage('java', lang_java.java);
  highlight.registerLanguage('javascript', lang_js.javascript);
  highlight.registerLanguage('js', lang_js.javascript);
  highlight.registerLanguage('python', lang_python.python);
  highlight.registerLanguage('py', lang_python.python);
  highlight.registerLanguage('sql', lang_sql.sql);
  highlight.registerLanguage('html', lang_xml.xml);
  highlight.registerLanguage('xml', lang_xml.xml);
  highlight.registerLanguage('jsp', lang_xml.xml);
  _highlightLanguagesRegistered = true;
}

/// Code block trong bubble AI — header ngôn ngữ + copy + syntax highlight.
class MarkdownCodeBlock extends StatelessWidget {
  const MarkdownCodeBlock({
    super.key,
    required this.code,
    this.language,
  });

  final String code;
  final String? language;

  static const _codeBg = Color(0xFF1E1A17);
  static const _codeHeaderBg = Color(0xFF2A2520);

  String get _displayLanguage {
    final raw = (language ?? '').trim().toLowerCase();
    if (raw.isEmpty) return 'Code';
    const labels = {
      'java': 'Java',
      'python': 'Python',
      'py': 'Python',
      'javascript': 'JavaScript',
      'js': 'JavaScript',
      'typescript': 'TypeScript',
      'ts': 'TypeScript',
      'dart': 'Dart',
      'sql': 'SQL',
      'html': 'HTML',
      'xml': 'XML',
      'jsp': 'JSP',
      'csharp': 'C#',
      'cs': 'C#',
      'cpp': 'C++',
      'c': 'C',
      'text': 'Text',
      'bash': 'Bash',
      'shell': 'Shell',
    };
    return labels[raw] ?? raw[0].toUpperCase() + raw.substring(1);
  }

  String get _highlightLanguage {
    final raw = (language ?? '').trim().toLowerCase();
    if (raw.isEmpty) return 'dart';
    const map = {
      'py': 'python',
      'js': 'javascript',
      'ts': 'javascript',
      'jsp': 'xml',
      'html': 'xml',
      'text': 'dart',
      'bash': 'dart',
      'shell': 'dart',
    };
    return map[raw] ?? raw;
  }

  Map<String, TextStyle> get _highlightTheme => {
    'root': codeStyle().copyWith(
      color: const Color(0xFFE8E2DA),
      backgroundColor: Colors.transparent,
      fontSize: 13,
      height: 1.45,
    ),
    'keyword': codeStyle().copyWith(color: const Color(0xFFFF9D6E)),
    'string': codeStyle().copyWith(color: const Color(0xFF8FD4A8)),
    'comment': codeStyle().copyWith(color: const Color(0xFF8C8278)),
    'number': codeStyle().copyWith(color: const Color(0xFF7EB8FF)),
    'class': codeStyle().copyWith(color: const Color(0xFFFFD166)),
    'title': codeStyle().copyWith(color: const Color(0xFFFFD166)),
    'built_in': codeStyle().copyWith(color: const Color(0xFF7EB8FF)),
    'literal': codeStyle().copyWith(color: const Color(0xFFFF9D6E)),
    'name': codeStyle().copyWith(color: const Color(0xFFE8E2DA)),
    'meta': codeStyle().copyWith(color: const Color(0xFF8C8278)),
  };

  void _copy(BuildContext context) {
    Clipboard.setData(ClipboardData(text: code.trimRight()));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Đã sao chép code')),
    );
  }

  @override
  Widget build(BuildContext context) {
    _ensureHighlightLanguages();

    return Container(
      margin: const EdgeInsets.symmetric(vertical: Insets.sm),
      decoration: BoxDecoration(
        color: _codeBg,
        borderRadius: BorderRadius.circular(Radii.md),
        border: Border.all(color: const Color(0xFF3A342E)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            color: _codeHeaderBg,
            padding: const EdgeInsets.symmetric(
              horizontal: Insets.md,
              vertical: Insets.sm,
            ),
            child: Row(
              children: [
                const Icon(
                  LucideIcons.code2,
                  size: 14,
                  color: Color(0xFFB6ADA2),
                ),
                const Gap(Insets.xs),
                Text(
                  _displayLanguage,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: const Color(0xFFB6ADA2),
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                  ),
                ),
                const Spacer(),
                InkWell(
                  onTap: () => _copy(context),
                  borderRadius: BorderRadius.circular(Radii.sm),
                  child: Padding(
                    padding: const EdgeInsets.all(Insets.xs),
                    child: const Icon(
                      LucideIcons.copy,
                      size: 16,
                      color: Color(0xFFB6ADA2),
                    ),
                  ),
                ),
              ],
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.all(Insets.md),
            child: HighlightView(
              code.trimRight(),
              language: _highlightLanguage,
              theme: _highlightTheme,
              textStyle: codeStyle().copyWith(
                fontSize: 13,
                height: 1.45,
                color: const Color(0xFFE8E2DA),
              ),
              padding: EdgeInsets.zero,
            ),
          ),
        ],
      ),
    );
  }
}
