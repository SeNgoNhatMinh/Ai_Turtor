import 'dart:async';

import 'package:flutter/material.dart';

import '../../features/ai_tutor/data/markdown_reveal.dart';
import '../../core/utils/ai_chat_content.dart';
import 'ai_markdown_body.dart';

class AiMarkdownReveal extends StatefulWidget {
  const AiMarkdownReveal({
    super.key,
    required this.data,
    this.enabled = false,
    this.onStudyTipTap,
    this.onComplete,
  });

  final String data;
  final bool enabled;
  final ValueChanged<String>? onStudyTipTap;
  final VoidCallback? onComplete;

  @override
  State<AiMarkdownReveal> createState() => _AiMarkdownRevealState();
}

class _AiMarkdownRevealState extends State<AiMarkdownReveal> {
  Timer? _timer;
  var _index = 0;

  var _started = false;
  var _completionNotified = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    _startIfNeeded();
  }

  @override
  void didUpdateWidget(covariant AiMarkdownReveal oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.data != widget.data || oldWidget.enabled != widget.enabled) {
      _timer?.cancel();
      _index = 0;
      _completionNotified = false;
      _startIfNeeded();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startIfNeeded() {
    final reducedMotion = MediaQuery.disableAnimationsOf(context);
    if (!shouldRevealAnswer(
      enabled: widget.enabled,
      markdown: widget.data,
      reducedMotion: reducedMotion,
    )) {
      _index = widget.data.length;
      _notifyComplete();
      return;
    }
    _index = 0;
    final step = revealStepSize(widget.data.length);
    _timer = Timer.periodic(const Duration(milliseconds: 16), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      final next = nextRevealIndex(widget.data, _index, step);
      setState(() => _index = next);
      if (next >= widget.data.length) {
        timer.cancel();
        _notifyComplete();
      }
    });
  }

  void _notifyComplete() {
    if (_completionNotified) return;
    _completionNotified = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.onComplete?.call();
    });
  }

  @override
  Widget build(BuildContext context) {
    final visible = widget.enabled && _index < widget.data.length
        ? sliceMarkdownForReveal(widget.data, _index)
        : widget.data;
    return AiMarkdownBody(
      data: prepareAiChatMarkdown(visible),
      onStudyTipTap: widget.onStudyTipTap,
    );
  }
}
