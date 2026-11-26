import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gap/gap.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_tokens.dart';
import '../../../../core/theme/app_typography.dart';
import '../../data/guided_practice.dart';

/// What the student typed for one answer's exercise.
class GuidedPracticeDraft {
  const GuidedPracticeDraft({required this.values, this.submitted = false});

  final List<String> values;
  final bool submitted;
}

/// Drafts keyed by assistant message id, so answers survive scrolling the
/// chat list and reopening the popup.
final guidedPracticeDraftsProvider =
    StateProvider<Map<String, GuidedPracticeDraft>>((ref) => const {});

/// Compact card shown in place of the exercise inside an AI answer. Tapping
/// it opens the whole exercise in a popup with an input at every blank.
class GuidedPracticeCard extends ConsumerWidget {
  const GuidedPracticeCard({
    super.key,
    required this.practice,
    required this.draftKey,
    this.enabled = true,
    this.onSubmit,
  });

  final GuidedPractice practice;
  final String draftKey;
  final bool enabled;

  /// Receives the filled exercise as the message for AI Tutor to check.
  final ValueChanged<String>? onSubmit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final draft = ref.watch(
      guidedPracticeDraftsProvider.select((drafts) => drafts[draftKey]),
    );
    final total = practice.inputCount;
    final filled = (draft?.values ?? const <String>[])
        .where((value) => value.trim().isNotEmpty)
        .length;
    final submitted = draft?.submitted ?? false;
    final theme = Theme.of(context);

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
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(
                  LucideIcons.pencilLine,
                  size: 18,
                  color: AppColors.primaryTint,
                ),
                const Gap(Insets.sm),
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
                  submitted ? 'Đã nộp' : '$filled/$total chỗ',
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: submitted ? AppColors.success : AppColors.textSecondary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const Gap(Insets.xs),
            Text(
              practice.prose.isNotEmpty
                  ? practice.prose
                  : 'Điền vào các chỗ trống dựa trên phần vừa học.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: AppColors.textSecondary,
                height: 1.45,
              ),
            ),
            const Gap(Insets.md),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () => showGuidedPracticeSheet(
                  context,
                  practice: practice,
                  draftKey: draftKey,
                  enabled: enabled,
                  onSubmit: onSubmit,
                ),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                ),
                icon: Icon(
                  submitted ? LucideIcons.eye : LucideIcons.squarePen,
                  size: 18,
                ),
                label: Text(
                  submitted
                      ? 'Xem bài đã nộp'
                      : filled > 0
                      ? 'Tiếp tục làm bài'
                      : 'Làm bài tập',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Future<void> showGuidedPracticeSheet(
  BuildContext context, {
  required GuidedPractice practice,
  required String draftKey,
  bool enabled = true,
  ValueChanged<String>? onSubmit,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: AppColors.card,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl)),
    ),
    builder: (_) => _GuidedPracticeSheet(
      practice: practice,
      draftKey: draftKey,
      enabled: enabled,
      onSubmit: onSubmit,
    ),
  );
}

class _GuidedPracticeSheet extends ConsumerStatefulWidget {
  const _GuidedPracticeSheet({
    required this.practice,
    required this.draftKey,
    required this.enabled,
    this.onSubmit,
  });

  final GuidedPractice practice;
  final String draftKey;
  final bool enabled;
  final ValueChanged<String>? onSubmit;

  @override
  ConsumerState<_GuidedPracticeSheet> createState() =>
      _GuidedPracticeSheetState();
}

class _GuidedPracticeSheetState extends ConsumerState<_GuidedPracticeSheet> {
  late final List<TextEditingController> _controllers;
  late final List<FocusNode> _focusNodes;
  late final bool _submitted;

  @override
  void initState() {
    super.initState();
    final draft = ref.read(guidedPracticeDraftsProvider)[widget.draftKey];
    _submitted = draft?.submitted ?? false;
    final count = widget.practice.inputCount;
    _controllers = List.generate(
      count,
      (index) => TextEditingController(
        text: index < (draft?.values.length ?? 0) ? draft!.values[index] : '',
      ),
    );
    _focusNodes = List.generate(count, (_) => FocusNode());
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

  bool get _locked => _submitted || !widget.enabled;

  List<String> get _values => [for (final c in _controllers) c.text];

  void _saveDraft({bool submitted = false}) {
    final notifier = ref.read(guidedPracticeDraftsProvider.notifier);
    notifier.state = {
      ...notifier.state,
      widget.draftKey: GuidedPracticeDraft(
        values: _values,
        submitted: submitted || _submitted,
      ),
    };
  }

  void _onChanged() {
    _saveDraft();
    setState(() {});
  }

  void _submit() {
    final message = filledPracticeMessage(widget.practice, _values);
    if (message.isEmpty || _locked) return;
    _saveDraft(submitted: true);
    Navigator.of(context).pop();
    widget.onSubmit?.call(message);
  }

  Widget _blankField(int index) {
    final controller = _controllers[index];
    final isLast = index == _controllers.length - 1;
    // Grow with the text so the exercise keeps its shape while typing.
    final width = (controller.text.length * 9.0 + 40).clamp(88.0, 240.0);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 3),
      child: SizedBox(
        width: width,
        child: TextField(
          controller: controller,
          focusNode: _focusNodes[index],
          readOnly: _locked,
          onChanged: (_) => _onChanged(),
          textInputAction: isLast ? TextInputAction.done : TextInputAction.next,
          onSubmitted: (_) {
            if (!isLast) _focusNodes[index + 1].requestFocus();
          },
          style: codeStyle().copyWith(
            fontSize: 14,
            color: AppColors.textPrimary,
          ),
          decoration: InputDecoration(
            isDense: true,
            hintText: 'chỗ ${index + 1}',
            hintStyle: codeStyle().copyWith(
              fontSize: 13,
              color: AppColors.textTertiary,
            ),
            filled: true,
            fillColor: _locked ? AppColors.raised : AppColors.card,
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
    final practice = widget.practice;
    final theme = Theme.of(context);
    final textStyle = codeStyle().copyWith(
      fontSize: 14,
      height: 1.6,
      color: AppColors.textPrimary,
    );
    final filled = _values.where((value) => value.trim().isNotEmpty).length;
    final total = practice.inputCount;
    final canSubmit = !_locked && filled == total && widget.onSubmit != null;

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
                      child: _blankField(index),
                    ),
                  },
              ],
            ),
          )
        : Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                practice.code.isNotEmpty ? practice.code : practice.section,
                style: textStyle,
              ),
              const Gap(Insets.md),
              Text('Câu trả lời của bạn', style: theme.textTheme.labelLarge),
              const Gap(Insets.xs),
              TextField(
                controller: _controllers.first,
                readOnly: _locked,
                minLines: 2,
                maxLines: 6,
                onChanged: (_) => _onChanged(),
                decoration: const InputDecoration(
                  hintText: 'Nhập câu trả lời…',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          );

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.92,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                Insets.lg,
                Insets.md,
                Insets.sm,
                Insets.xs,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Bài tập có hướng dẫn',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  Text(
                    _submitted ? 'Đã nộp' : '$filled/$total chỗ',
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  IconButton(
                    tooltip: 'Đóng',
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(LucideIcons.x),
                  ),
                ],
              ),
            ),
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(
                  Insets.lg,
                  0,
                  Insets.lg,
                  Insets.md,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (practice.prose.isNotEmpty) ...[
                      Text(
                        practice.prose,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: AppColors.textSecondary,
                          height: 1.45,
                        ),
                      ),
                      const Gap(Insets.md),
                    ],
                    Container(
                      padding: const EdgeInsets.all(Insets.md),
                      decoration: BoxDecoration(
                        color: AppColors.raised,
                        borderRadius: BorderRadius.circular(Radii.md),
                        border: Border.all(color: AppColors.borderHairline),
                      ),
                      child: exercise,
                    ),
                    const Gap(Insets.sm),
                    Text(
                      _submitted
                          ? 'Bạn đã nộp bài. AI Tutor đang/đã kiểm tra phần bạn điền trong khung chat.'
                          : !widget.enabled
                          ? 'Hiện chưa gửi được bài. Bài làm vẫn được giữ lại.'
                          : 'Bài làm được tự lưu. Điền đủ $total chỗ rồi bấm Nộp bài để AI Tutor kiểm tra.',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (!_submitted)
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  Insets.lg,
                  Insets.xs,
                  Insets.lg,
                  Insets.md,
                ),
                child: FilledButton.icon(
                  onPressed: canSubmit ? _submit : null,
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(48),
                  ),
                  icon: const Icon(LucideIcons.send, size: 18),
                  label: Text(
                    filled == total ? 'Nộp bài' : 'Còn ${total - filled} chỗ trống',
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
