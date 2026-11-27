import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:gap/gap.dart';

import '../../../../core/network/network_providers.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_tokens.dart';
import '../../../../core/theme/app_typography.dart';
import '../../data/guided_practice.dart';

/// Saved work for one answer's exercise (web `guided-practice-draft:<id>`).
///
/// [text] is the filled exercise; [locked] means the student can no longer
/// edit it; [reviewed] means the combined "Ôn tập lại" turn was already sent.
class GuidedPracticeDraft {
  const GuidedPracticeDraft({
    required this.values,
    this.text = '',
    this.locked = false,
    this.reviewed = false,
  });

  final List<String> values;
  final String text;
  final bool locked;
  final bool reviewed;

  bool get saved => text.trim().isNotEmpty;

  Map<String, Object> toJson() => {
    'values': values,
    'text': text,
    'locked': locked,
    'reviewed': reviewed,
  };

  static GuidedPracticeDraft? fromJson(Object? json) {
    if (json is! Map) return null;
    final values = json['values'];
    return GuidedPracticeDraft(
      values: values is List ? values.map((v) => '$v').toList() : const [],
      text: '${json['text'] ?? ''}',
      locked: json['locked'] == true,
      reviewed: json['reviewed'] == true,
    );
  }

  GuidedPracticeDraft copyWith({
    List<String>? values,
    String? text,
    bool? locked,
    bool? reviewed,
  }) {
    return GuidedPracticeDraft(
      values: values ?? this.values,
      text: text ?? this.text,
      locked: locked ?? this.locked,
      reviewed: reviewed ?? this.reviewed,
    );
  }
}

/// Drafts keyed by assistant message id, so work survives scrolling the chat.
final guidedPracticeDraftsProvider =
    StateProvider<Map<String, GuidedPracticeDraft>>((ref) => const {});

const _draftStorePrefix = 'guided_practice_draft:';

/// Saves a draft in memory and on the device (web keeps it in localStorage),
/// so a reopened app neither loses the work nor grades it a second time.
void writeGuidedPracticeDraft(
  WidgetRef ref,
  String messageId,
  GuidedPracticeDraft draft,
) {
  final notifier = ref.read(guidedPracticeDraftsProvider.notifier);
  notifier.state = {...notifier.state, messageId: draft};
  unawaited(_storeDraft(ref.read(secureStorageProvider), messageId, draft));
}

Future<void> _storeDraft(
  FlutterSecureStorage storage,
  String messageId,
  GuidedPracticeDraft draft,
) async {
  if (messageId.trim().isEmpty) return;
  try {
    await storage.write(
      key: '$_draftStorePrefix$messageId',
      value: jsonEncode(draft.toJson()),
    );
  } catch (_) {
    // Storage can be unavailable; the in-memory draft still holds.
  }
}

Future<GuidedPracticeDraft?> _loadDraft(
  FlutterSecureStorage storage,
  String messageId,
) async {
  if (messageId.trim().isEmpty) return null;
  try {
    final raw = await storage.read(key: '$_draftStorePrefix$messageId');
    if (raw == null || raw.isEmpty) return null;
    return GuidedPracticeDraft.fromJson(jsonDecode(raw));
  } catch (_) {
    return null;
  }
}

/// Exercise shown inside the AI answer with an input at every blank, like web
/// `GuidedPracticeFill`. Saving only keeps the work: when the answer also has
/// a quiz, AI Tutor grades both once the quiz is finished; otherwise no new
/// answer is created.
class GuidedPracticeCard extends ConsumerStatefulWidget {
  const GuidedPracticeCard({
    super.key,
    required this.practice,
    required this.draftKey,
    this.enabled = true,
    this.waitsForQuiz = false,
    this.quizFinished = false,
    this.onSaved,
  });

  final GuidedPractice practice;
  final String draftKey;
  final bool enabled;

  /// The answer also has a quiz; the work is graded after the quiz.
  final bool waitsForQuiz;
  final bool quizFinished;

  /// Called with the filled exercise after each save.
  final ValueChanged<String>? onSaved;

  @override
  ConsumerState<GuidedPracticeCard> createState() => _GuidedPracticeCardState();
}

class _GuidedPracticeCardState extends ConsumerState<GuidedPracticeCard> {
  late final List<TextEditingController> _controllers;
  late final List<FocusNode> _focusNodes;

  @override
  void initState() {
    super.initState();
    final draft = ref.read(guidedPracticeDraftsProvider)[widget.draftKey];
    final count = widget.practice.inputCount;
    _controllers = List.generate(
      count,
      (index) => TextEditingController(
        text: index < (draft?.values.length ?? 0) ? draft!.values[index] : '',
      ),
    );
    _focusNodes = List.generate(count, (_) => FocusNode());
    if (draft == null) unawaited(_restoreStoredDraft());
  }

  Future<void> _restoreStoredDraft() async {
    final stored = await _loadDraft(
      ref.read(secureStorageProvider),
      widget.draftKey,
    );
    if (stored == null || !mounted) return;
    final notifier = ref.read(guidedPracticeDraftsProvider.notifier);
    if (notifier.state.containsKey(widget.draftKey)) return;
    notifier.state = {...notifier.state, widget.draftKey: stored};
    for (var i = 0; i < _controllers.length && i < stored.values.length; i++) {
      _controllers[i].text = stored.values[i];
    }
    setState(() {});
  }

  @override
  void dispose() {
    for (final controller in _controllers) {
      controller.dispose();
    }
    for (final node in _focusNodes) {
      node.dispose();
    }
    super.dispose();
  }

  List<String> get _values => [for (final c in _controllers) c.text.trim()];

  String get _currentText => filledPracticeMessage(widget.practice, _values);

  void _save(GuidedPracticeDraft? draft) {
    final text = _currentText;
    final locked =
        draft?.locked == true ||
        (widget.quizFinished && (draft?.saved ?? false));
    if (text.isEmpty || locked || !widget.enabled) return;
    final finished = !widget.waitsForQuiz || widget.quizFinished;
    writeGuidedPracticeDraft(
      ref,
      widget.draftKey,
      GuidedPracticeDraft(
        values: _values,
        text: text,
        locked: finished,
        reviewed: draft?.reviewed ?? false,
      ),
    );
    widget.onSaved?.call(text);
  }

  Widget _blankField(int index, bool locked, GuidedPracticeDraft? draft) {
    final controller = _controllers[index];
    final isLast = index == _controllers.length - 1;
    // Grows with the text, like the web `ch` width.
    final width = (controller.text.length * 9.0 + 32).clamp(104.0, 240.0);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 3),
      child: SizedBox(
        width: width,
        child: TextField(
          controller: controller,
          focusNode: _focusNodes[index],
          readOnly: locked,
          onChanged: (_) => setState(() {}),
          textInputAction: isLast ? TextInputAction.done : TextInputAction.next,
          onSubmitted: (_) {
            if (!isLast) {
              _focusNodes[index + 1].requestFocus();
            } else {
              _save(draft);
            }
          },
          style: codeStyle().copyWith(
            fontSize: 14,
            color: AppColors.textPrimary,
          ),
          decoration: InputDecoration(
            isDense: true,
            hintText: 'điền vào đây',
            hintStyle: codeStyle().copyWith(
              fontSize: 13,
              color: AppColors.textTertiary,
            ),
            filled: true,
            fillColor: locked ? AppColors.raised : AppColors.card,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 8,
              vertical: 8,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(Radii.sm),
              borderSide: const BorderSide(color: AppColors.primaryTint),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(Radii.sm),
              borderSide: const BorderSide(
                color: AppColors.focusRing,
                width: 1.5,
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final draft = ref.watch(
      guidedPracticeDraftsProvider.select((drafts) => drafts[widget.draftKey]),
    );
    final practice = widget.practice;
    final theme = Theme.of(context);
    final savedText = draft?.text ?? '';
    final completedByQuiz = widget.quizFinished && savedText.isNotEmpty;
    final locked = (draft?.locked ?? false) || completedByQuiz;
    final inputLocked = locked || !widget.enabled;
    final total = practice.inputCount;
    final filled = _values.where((value) => value.isNotEmpty).length;
    final currentText = _currentText;
    final bothFinished =
        savedText.isNotEmpty && (!widget.waitsForQuiz || widget.quizFinished);
    final pendingChange = savedText.isNotEmpty && currentText != savedText;
    final canSave =
        widget.enabled &&
        !locked &&
        currentText.isNotEmpty &&
        (savedText.isEmpty || pendingChange);
    final buttonLabel = locked || bothFinished
        ? 'Đã nộp'
        : savedText.isNotEmpty && !pendingChange
        ? 'Đã lưu bài làm'
        : savedText.isNotEmpty
        ? 'Cập nhật bài làm'
        : 'Lưu bài làm';
    final hint = widget.waitsForQuiz
        ? 'Lưu bài làm chỉ giữ bản nháp. Làm xong cả bài tập và quiz thì AI giảng lại concept và chỉ ra chỗ sai.'
        : 'Lưu bài làm tại đây. Phần này không tạo câu trả lời mới.';

    final textStyle = codeStyle().copyWith(
      fontSize: 14,
      height: 1.6,
      color: AppColors.textPrimary,
    );
    final exercise = practice.blankCount > 0
        ? Text.rich(
            TextSpan(
              style: textStyle,
              children: [
                for (final segment in practice.segments)
                  switch (segment) {
                    PracticeText(:final text) => TextSpan(text: text),
                    PracticeBlank(:final index) => WidgetSpan(
                      alignment: PlaceholderAlignment.middle,
                      child: _blankField(index, inputLocked, draft),
                    ),
                  },
              ],
            ),
          )
        : Text.rich(
            TextSpan(
              style: textStyle,
              children: [
                TextSpan(
                  text: practice.code.isNotEmpty
                      ? practice.code
                      : practice.section,
                ),
                const TextSpan(text: '\n'),
                WidgetSpan(
                  alignment: PlaceholderAlignment.middle,
                  child: _blankField(0, inputLocked, draft),
                ),
              ],
            ),
          );

    return Semantics(
      label: 'Bài tập có hướng dẫn',
      container: true,
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.symmetric(vertical: Insets.sm),
        padding: const EdgeInsets.all(Insets.md),
        decoration: BoxDecoration(
          color: AppColors.primaryWash,
          borderRadius: BorderRadius.circular(Radii.md),
          border: Border.all(color: AppColors.borderHairline),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Bài tập có hướng dẫn',
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
                Text(
                  '$filled/$total chỗ',
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            if (practice.prose.isNotEmpty) ...[
              const Gap(Insets.xs),
              Text(
                practice.prose,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: AppColors.textSecondary,
                  height: 1.45,
                ),
              ),
            ],
            const Gap(Insets.xs),
            Text(
              hint,
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary,
                height: 1.4,
              ),
            ),
            const Gap(Insets.sm),
            Container(
              padding: const EdgeInsets.all(Insets.md),
              decoration: BoxDecoration(
                color: AppColors.raised,
                borderRadius: BorderRadius.circular(Radii.md),
                border: Border.all(color: AppColors.borderHairline),
              ),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    minWidth: MediaQuery.sizeOf(context).width * 0.6,
                  ),
                  child: exercise,
                ),
              ),
            ),
            const Gap(Insets.md),
            Align(
              alignment: Alignment.centerLeft,
              child: FilledButton(
                onPressed: canSave ? () => _save(draft) : null,
                style: FilledButton.styleFrom(minimumSize: const Size(48, 44)),
                child: Text(buttonLabel),
              ),
            ),
            if (savedText.isNotEmpty && !locked) ...[
              const Gap(Insets.xs),
              Text(
                'Đã lưu bài làm. Bạn vẫn sửa được cho đến khi làm xong cả quiz.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
            ],
            if (locked) ...[
              const Gap(Insets.xs),
              Text(
                widget.waitsForQuiz
                    ? 'AI Tutor sẽ giảng lại concept của bài và chỉ ra chỗ sai ở tin nhắn tiếp theo.'
                    : 'Đã lưu bài làm. Không tạo câu trả lời mới.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
