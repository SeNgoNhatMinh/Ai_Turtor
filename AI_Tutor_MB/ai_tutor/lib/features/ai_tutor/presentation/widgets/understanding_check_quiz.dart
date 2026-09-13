import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_tokens.dart';
import '../../data/understanding_check.dart';

class UnderstandingCheckQuiz extends StatefulWidget {
  const UnderstandingCheckQuiz({
    super.key,
    required this.quiz,
    this.lockedKey = '',
    this.localLockedKey = '',
    this.onLockAnswer,
  });

  final UnderstandingQuiz quiz;
  final String lockedKey;
  final String localLockedKey;
  final void Function(String key, UnderstandingCheckAttempt attempt)?
  onLockAnswer;

  @override
  State<UnderstandingCheckQuiz> createState() => _UnderstandingCheckQuizState();
}

class _UnderstandingCheckQuizState extends State<UnderstandingCheckQuiz> {
  late String _localKey;
  var _checkingMissingKey = false;

  @override
  void initState() {
    super.initState();
    _localKey = widget.localLockedKey.trim().toUpperCase();
  }

  @override
  void didUpdateWidget(covariant UnderstandingCheckQuiz oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.localLockedKey != oldWidget.localLockedKey &&
        widget.localLockedKey.trim().isNotEmpty) {
      _localKey = widget.localLockedKey.trim().toUpperCase();
    }
  }

  String get _selectedKey {
    final fromStudent = widget.lockedKey.trim().toUpperCase();
    if (fromStudent.isNotEmpty) return fromStudent;
    return _localKey;
  }

  void _lockAnswer(String key) {
    if (_selectedKey.isNotEmpty) return;
    final nextKey = key.trim().toUpperCase();
    final selected = widget.quiz.optionFor(nextKey);
    if (selected == null) return;
    setState(() {
      _localKey = nextKey;
      if (widget.quiz.correctKey.isEmpty) _checkingMissingKey = true;
    });
    widget.onLockAnswer?.call(
      nextKey,
      UnderstandingCheckAttempt(
        quiz: widget.quiz,
        selected: selected,
        isCorrect:
            widget.quiz.correctKey.isNotEmpty &&
            nextKey == widget.quiz.correctKey,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final quiz = widget.quiz;
    if (quiz.question.trim().isEmpty || quiz.options.length < 2) {
      return const SizedBox.shrink();
    }

    final selectedKey = _selectedKey;
    final locked = selectedKey.isNotEmpty;
    final selected = quiz.optionFor(selectedKey);
    final hasKey = quiz.correctKey.isNotEmpty;
    final isCorrect = hasKey && selectedKey == quiz.correctKey;
    final correctOption = quiz.optionFor(quiz.correctKey);
    final hint = locked
        ? 'Đã khóa đáp án. Giáo viên xem được kết quả này để gửi chỉ dẫn cho lần học sau.'
        : 'Chọn một lần. Kết quả đúng/sai và giải thích được giữ; không đổi được sau khi chọn.';

    return Semantics(
      label: 'Kiểm tra hiểu',
      container: true,
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.only(top: Insets.sm),
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
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  LucideIcons.circleHelp,
                  size: 16,
                  color: AppColors.primaryTint,
                ),
                const Gap(Insets.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Kiểm tra hiểu',
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const Gap(2),
                      Text(
                        hint,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.textSecondary,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const Gap(Insets.sm),
            Text(
              quiz.question,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
                height: 1.4,
              ),
            ),
            const Gap(Insets.sm),
            for (final option in quiz.options)
              Padding(
                padding: const EdgeInsets.only(bottom: Insets.xs),
                child: _OptionButton(
                  option: option,
                  selected: selectedKey == option.key,
                  showGrade: locked && hasKey,
                  isCorrectChoice: option.key == quiz.correctKey,
                  locked: locked,
                  onTap: () => _lockAnswer(option.key),
                ),
              ),
            if (selected != null) ...[
              const Gap(Insets.xs),
              _ResultCard(
                hasKey: hasKey,
                isCorrect: isCorrect,
                selected: selected,
                correctKey: quiz.correctKey,
                correctText: correctOption?.text,
                explanation: quiz.explanation,
                checkingMissingKey: _checkingMissingKey,
                onAskAgain: !hasKey && widget.onLockAnswer != null
                    ? () {
                        setState(() => _checkingMissingKey = true);
                        widget.onLockAnswer!(
                          selected.key,
                          UnderstandingCheckAttempt(
                            quiz: quiz,
                            selected: selected,
                            isCorrect: false,
                          ),
                        );
                      }
                    : null,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _OptionButton extends StatelessWidget {
  const _OptionButton({
    required this.option,
    required this.selected,
    required this.showGrade,
    required this.isCorrectChoice,
    required this.locked,
    required this.onTap,
  });

  final UnderstandingOption option;
  final bool selected;
  final bool showGrade;
  final bool isCorrectChoice;
  final bool locked;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final Color border;
    final Color fill;
    if (showGrade && isCorrectChoice) {
      border = AppColors.success;
      fill = AppColors.successBg;
    } else if (showGrade && selected && !isCorrectChoice) {
      border = AppColors.error;
      fill = AppColors.errorBg;
    } else if (selected) {
      border = AppColors.primaryTint;
      fill = AppColors.card;
    } else {
      border = AppColors.borderHairline;
      fill = AppColors.card;
    }

    return Material(
      color: fill,
      borderRadius: BorderRadius.circular(Radii.sm),
      child: InkWell(
        onTap: locked ? null : onTap,
        borderRadius: BorderRadius.circular(Radii.sm),
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(Radii.sm),
            border: Border.all(color: border),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: Insets.sm,
              vertical: Insets.sm,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 22,
                  height: 22,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: AppColors.primaryWash,
                    borderRadius: BorderRadius.circular(Radii.sm),
                  ),
                  child: Text(
                    option.key,
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: AppColors.primary,
                    ),
                  ),
                ),
                const Gap(Insets.sm),
                Expanded(
                  child: Text(
                    option.text,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.textPrimary,
                      height: 1.35,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ResultCard extends StatelessWidget {
  const _ResultCard({
    required this.hasKey,
    required this.isCorrect,
    required this.selected,
    required this.correctKey,
    required this.correctText,
    required this.explanation,
    required this.checkingMissingKey,
    this.onAskAgain,
  });

  final bool hasKey;
  final bool isCorrect;
  final UnderstandingOption selected;
  final String correctKey;
  final String? correctText;
  final String explanation;
  final bool checkingMissingKey;
  final VoidCallback? onAskAgain;

  @override
  Widget build(BuildContext context) {
    final fill = !hasKey
        ? AppColors.raised
        : isCorrect
        ? AppColors.successBg
        : AppColors.errorBg;
    final title = !hasKey
        ? 'Bạn chọn ${selected.key}.'
        : isCorrect
        ? 'Đúng rồi.'
        : 'Chưa đúng.';
    final body = !hasKey
        ? 'AI Tutor đang kiểm tra đáp án và sẽ giảng lại ngay bên dưới.'
        : isCorrect
        ? 'Bạn chọn ${selected.key}: ${selected.text}'
        : 'Bạn chọn ${selected.key}. Đáp án đúng là $correctKey${correctText == null || correctText!.isEmpty ? '' : ': $correctText'}.';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(Insets.sm),
      decoration: BoxDecoration(
        color: fill,
        borderRadius: BorderRadius.circular(Radii.sm),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          const Gap(4),
          Text(
            body,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppColors.textSecondary,
              height: 1.35,
            ),
          ),
          if (hasKey && explanation.trim().isNotEmpty) ...[
            const Gap(4),
            Text(
              explanation,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.textPrimary,
                height: 1.35,
              ),
            ),
          ],
          if (!hasKey && onAskAgain != null) ...[
            const Gap(Insets.sm),
            TextButton(
              onPressed: checkingMissingKey ? null : onAskAgain,
              child: Text(
                checkingMissingKey ? 'Đang kiểm tra…' : 'Kiểm tra đáp án',
              ),
            ),
          ],
        ],
      ),
    );
  }
}
