import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:gap/gap.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/constants/app_assets.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_tokens.dart';
import '../../../../core/utils/vietnamese_text_input.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../shared/widgets/ai_suggestion_json.dart';
import '../../../../shared/widgets/widgets.dart';
import '../../data/daily_question_quota.dart';

enum AnswerReviewFeedbackKind { wrong, reportSource }

/// Nút ?! cạnh linh vật Cóc — giải thích ngôn ngữ hỗ trợ của RAG.
class AiLanguageHintButton extends StatelessWidget {
  const AiLanguageHintButton({super.key, required this.tooltip});

  final String tooltip;

  static void showDialogFor(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        title: Text(l10n.aiLanguageHintTitle),
        content: Text(
          l10n.aiLanguageHintBody,
          style: Theme.of(ctx).textTheme.bodyMedium?.copyWith(height: 1.45),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(l10n.aiLanguageHintGotIt),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.warningBg,
      borderRadius: BorderRadius.circular(Radii.full),
      child: InkWell(
        onTap: () => showDialogFor(context),
        borderRadius: BorderRadius.circular(Radii.full),
        child: Tooltip(
          message: tooltip,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
            child: Text(
              '?!',
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                fontWeight: FontWeight.w800,
                color: AppColors.warning,
                height: 1,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class AnswerReviewFeedbackResult {
  const AnswerReviewFeedbackResult({this.feedback, this.suggestedCorrection});

  final String? feedback;
  final String? suggestedCorrection;
}

Future<AnswerReviewFeedbackResult?> showAnswerReviewFeedbackSheet(
  BuildContext context, {
  required AppLocalizations l10n,
  required AnswerReviewFeedbackKind kind,
}) {
  final feedbackRequired = kind == AnswerReviewFeedbackKind.reportSource;
  final title = kind == AnswerReviewFeedbackKind.reportSource
      ? l10n.reviewReportDialogTitle
      : l10n.reviewWrongDialogTitle;

  return showModalBottomSheet<AnswerReviewFeedbackResult>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.card,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl)),
    ),
    builder: (sheetContext) => _AnswerReviewFeedbackSheet(
      title: title,
      feedbackHint: l10n.reviewFeedbackHint,
      correctionHint: l10n.reviewCorrectionHint,
      feedbackRequired: feedbackRequired,
      showCorrection: kind == AnswerReviewFeedbackKind.wrong,
      submitLabel: l10n.reviewSubmitFeedback,
      feedbackRequiredError: l10n.reviewFeedbackRequired,
    ),
  );
}

class _AnswerReviewFeedbackSheet extends StatefulWidget {
  const _AnswerReviewFeedbackSheet({
    required this.title,
    required this.feedbackHint,
    required this.correctionHint,
    required this.feedbackRequired,
    required this.showCorrection,
    required this.submitLabel,
    required this.feedbackRequiredError,
  });

  final String title;
  final String feedbackHint;
  final String correctionHint;
  final bool feedbackRequired;
  final bool showCorrection;
  final String submitLabel;
  final String feedbackRequiredError;

  @override
  State<_AnswerReviewFeedbackSheet> createState() =>
      _AnswerReviewFeedbackSheetState();
}

class _AnswerReviewFeedbackSheetState
    extends State<_AnswerReviewFeedbackSheet> {
  final _feedbackController = TextEditingController();
  final _correctionController = TextEditingController();
  String? _errorText;

  @override
  void dispose() {
    _feedbackController.dispose();
    _correctionController.dispose();
    super.dispose();
  }

  void _submit() {
    final feedback = _feedbackController.text.trim();
    if (widget.feedbackRequired && feedback.isEmpty) {
      setState(() => _errorText = widget.feedbackRequiredError);
      return;
    }
    Navigator.pop(
      context,
      AnswerReviewFeedbackResult(
        feedback: feedback.isEmpty ? null : feedback,
        suggestedCorrection: widget.showCorrection
            ? _correctionController.text.trim().isEmpty
                  ? null
                  : _correctionController.text.trim()
            : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        Insets.screenH,
        Insets.lg,
        Insets.screenH,
        MediaQuery.viewInsetsOf(context).bottom + Insets.xl,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(widget.title, style: Theme.of(context).textTheme.titleMedium),
            const Gap(Insets.lg),
            FptTextField(
              controller: _feedbackController,
              label: widget.feedbackHint,
              maxLines: 3,
              errorText: _errorText,
            ),
            if (widget.showCorrection) ...[
              const Gap(Insets.md),
              FptTextField(
                controller: _correctionController,
                label: widget.correctionHint,
                maxLines: 3,
              ),
            ],
            const Gap(Insets.lg),
            FptButton(
              label: widget.submitLabel,
              onPressed: _submit,
              expand: true,
            ),
          ],
        ),
      ),
    );
  }
}

class AiChatAppBar extends StatelessWidget implements PreferredSizeWidget {
  const AiChatAppBar({
    super.key,
    required this.courseCode,
    this.classLabel,
    this.onCourseTap,
    this.onHistoryTap,
    this.onSearchTap,
    this.questionCount,
    this.questionLimit = 10,
    this.maxTurnsReached = false,
  });

  final String courseCode;
  final String? classLabel;
  final VoidCallback? onCourseTap;
  final VoidCallback? onHistoryTap;
  final VoidCallback? onSearchTap;
  final int? questionCount;
  final int questionLimit;
  final bool maxTurnsReached;

  static String formatClassLabel({String? className, String? classId}) {
    final name = className?.trim() ?? '';
    if (name.isNotEmpty) return name;
    return classId?.trim() ?? '';
  }

  @override
  Size get preferredSize => const Size.fromHeight(84);

  @override
  Widget build(BuildContext context) {
    final historyTap = onHistoryTap;
    final searchTap = onSearchTap;

    final resolvedClass = (classLabel ?? '').trim();
    final hasClass = resolvedClass.isNotEmpty;

    return AppBar(
      toolbarHeight: 84,
      backgroundColor: AppColors.card,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      automaticallyImplyLeading: false,
      shape: const Border(),
      titleSpacing: 0,
      title: Row(
        children: [
          if (historyTap != null)
            Padding(
              padding: const EdgeInsets.only(left: Insets.sm),
              child: _ChatAppBarIconButton(
                tooltip: 'Lịch sử hội thoại',
                onPressed: historyTap,
                child: const FaIcon(
                  FontAwesomeIcons.bars,
                  size: 16,
                  color: AppColors.peacockBlue,
                ),
              ),
            )
          else
            const Gap(Insets.screenH),
          const Gap(Insets.sm),
          Expanded(
            child: Text(
              AppLocalizations.of(context)!.aiTutorName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
                color: AppColors.splashNavy,
                fontSize: 16,
              ),
            ),
          ),
        ],
      ),
      actions: [
        if (questionCount != null)
          Padding(
            padding: const EdgeInsets.only(right: Insets.xs),
            child: Center(
              child: Tooltip(
                message: maxTurnsReached
                    ? 'Bạn đã dùng hết $questionLimit câu hỏi hôm nay cho môn này'
                    : 'Số câu hỏi hôm nay cho môn này',
                child: Text(
                  'Câu hỏi $questionCount/$questionLimit',
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color:
                        maxTurnsReached ||
                            (questionCount ?? 0) >= (questionLimit - 2)
                        ? AppColors.error
                        : AppColors.peacockBlue,
                  ),
                ),
              ),
            ),
          ),
        if (searchTap != null)
          _ChatAppBarIconButton(
            tooltip: 'Tìm trong đoạn chat',
            onPressed: searchTap,
            child: const Icon(
              LucideIcons.search,
              size: 18,
              color: AppColors.peacockBlue,
            ),
          ),
        const Gap(Insets.xs),
        Padding(
          padding: const EdgeInsets.only(right: Insets.lg),
          child: IntrinsicWidth(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                GestureDetector(
                  onTap: onCourseTap,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: Insets.md,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.raised,
                      borderRadius: BorderRadius.circular(Radii.full),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          courseCode,
                          style: Theme.of(context).textTheme.labelLarge
                              ?.copyWith(
                                fontWeight: FontWeight.w700,
                                color: AppColors.peacockBlue,
                                fontSize: 13,
                              ),
                        ),
                        const Gap(Insets.xs),
                        const Icon(
                          LucideIcons.chevronDown,
                          size: 14,
                          color: AppColors.textTertiary,
                        ),
                      ],
                    ),
                  ),
                ),
                const Gap(4),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: Insets.md,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: hasClass
                        ? AppColors.raised
                        : const Color(0xFFFFF7ED),
                    borderRadius: BorderRadius.circular(Radii.full),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    hasClass ? 'Lớp $resolvedClass' : 'Chưa xếp lớp',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: hasClass
                          ? AppColors.textSecondary
                          : const Color(0xFF92400E),
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _ChatAppBarIconButton extends StatelessWidget {
  const _ChatAppBarIconButton({
    required this.tooltip,
    required this.onPressed,
    required this.child,
  });

  final String tooltip;
  final VoidCallback onPressed;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: AppColors.raised,
        borderRadius: BorderRadius.circular(Radii.full),
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(Radii.full),
          child: SizedBox(width: 36, height: 36, child: Center(child: child)),
        ),
      ),
    );
  }
}

class AiChatTurnLimitBanner extends StatelessWidget {
  const AiChatTurnLimitBanner({
    super.key,
    required this.message,
    required this.onOpenPrevious,
    required this.onDismiss,
  });

  final String message;
  final VoidCallback onOpenPrevious;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.primaryWash,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          Insets.screenH,
          Insets.sm,
          Insets.sm,
          Insets.sm,
        ),
        child: Row(
          children: [
            const Icon(LucideIcons.info, size: 16, color: AppColors.primary),
            const Gap(Insets.sm),
            Expanded(
              child: Text(
                message,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            TextButton(
              onPressed: onOpenPrevious,
              child: const Text('Quay lại'),
            ),
            IconButton(
              tooltip: 'Đóng',
              onPressed: onDismiss,
              icon: const Icon(LucideIcons.x, size: 16),
            ),
          ],
        ),
      ),
    );
  }
}

class AiChatTutorSessionStrip extends StatelessWidget {
  const AiChatTutorSessionStrip({
    super.key,
    required this.dailyQuotaExhausted,
    this.phase,
    this.supportLevel,
    this.status,
    this.summaryText,
    this.loading = false,
    this.onStartNext,
  });

  final bool dailyQuotaExhausted;
  final String? phase;
  final String? supportLevel;
  final String? status;
  final String? summaryText;
  final bool loading;
  final VoidCallback? onStartNext;

  static const companionTitle = 'AI Tutor đang đồng hành';
  static const completedHint = 'Đã tổng kết và gửi buổi học cho giảng viên';
  static const startNextLabel = 'Bắt đầu buổi tiếp theo';

  bool get _completed => (status ?? '').toUpperCase() == 'COMPLETED';

  @override
  Widget build(BuildContext context) {
    final title = dailyQuotaExhausted
        ? dailySessionCompleteTitle
        : companionTitle;
    final subtitle = dailyQuotaExhausted
        ? dailySessionCompleteMessage
        : _completed
        ? completedHint
        : 'Giai đoạn: ${phase?.isNotEmpty == true ? phase : 'OPEN'} · '
              'Mức hỗ trợ: ${supportLevel?.isNotEmpty == true ? supportLevel : 'STANDARD'}';

    final hasSummary = (summaryText ?? '').trim().isNotEmpty;
    if (!dailyQuotaExhausted && !_completed && !hasSummary) {
      return const SizedBox.shrink();
    }

    return Material(
      color: AppColors.canvas,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          Insets.screenH,
          Insets.sm,
          Insets.screenH,
          Insets.sm,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: AppColors.splashNavy,
                        ),
                      ),
                      const Gap(2),
                      Text(
                        subtitle,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.textSecondary,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ),
                ),
                if (_completed && !dailyQuotaExhausted && onStartNext != null)
                  TextButton(
                    onPressed: loading ? null : onStartNext,
                    child: Text(startNextLabel),
                  ),
              ],
            ),
            if (dailyQuotaExhausted) ...[
              const Gap(Insets.xs),
              Text(
                dailySessionCompleteHint,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textSecondary,
                  height: 1.4,
                ),
              ),
            ],
            if ((summaryText ?? '').trim().isNotEmpty) ...[
              const Gap(Insets.xs),
              Text(
                summaryText!.trim(),
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.textPrimary,
                  height: 1.4,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class AiChatComposerTopics extends StatelessWidget {
  const AiChatComposerTopics({
    super.key,
    required this.topics,
    required this.onSelect,
    this.enabled = true,
  });

  final List<String> topics;
  final ValueChanged<String> onSelect;
  final bool enabled;

  static const pickerLabel = 'Chọn bài học';
  static const sheetTitle = 'Bắt đầu bài nào?';
  static const sheetHint = 'Chọn một bài để gửi vào khung chat.';

  List<String> get _visibleTopics => [
    for (final topic in topics)
      if (topic.trim().isNotEmpty && !looksLikeSuggestionJson(topic))
        topic.trim(),
  ];

  @override
  Widget build(BuildContext context) {
    final visibleTopics = _visibleTopics;
    if (visibleTopics.isEmpty) return const SizedBox.shrink();
    final labelStyle = Theme.of(context).textTheme.bodyMedium?.copyWith(
      fontWeight: FontWeight.w600,
      color: enabled ? AppColors.textPrimary : AppColors.textDisabled,
    );
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        Insets.screenH,
        0,
        Insets.screenH,
        Insets.sm,
      ),
      child: Semantics(
        button: true,
        enabled: enabled,
        label: pickerLabel,
        child: Material(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(Radii.lg),
          child: InkWell(
            onTap: enabled ? () => _openPicker(context) : null,
            borderRadius: BorderRadius.circular(Radii.lg),
            child: Ink(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(Radii.lg),
                border: Border.all(color: AppColors.borderHairline),
              ),
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 48),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: Insets.lg,
                    vertical: Insets.sm,
                  ),
                  child: Row(
                    children: [
                      Icon(
                        LucideIcons.bookOpen,
                        size: 18,
                        color: enabled
                            ? AppColors.primaryTint
                            : AppColors.textDisabled,
                      ),
                      const Gap(Insets.sm),
                      Expanded(child: Text(pickerLabel, style: labelStyle)),
                      Text(
                        '${visibleTopics.length} bài',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: enabled
                              ? AppColors.textSecondary
                              : AppColors.textDisabled,
                        ),
                      ),
                      const Gap(Insets.xs),
                      Icon(
                        LucideIcons.chevronDown,
                        size: 18,
                        color: enabled
                            ? AppColors.textSecondary
                            : AppColors.textDisabled,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _openPicker(BuildContext context) async {
    final topics = _visibleTopics;
    final selected = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: AppColors.card,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl)),
      ),
      builder: (sheetContext) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              Insets.screenH,
              Insets.lg,
              Insets.screenH,
              Insets.lg,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  sheetTitle,
                  style: Theme.of(sheetContext).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const Gap(Insets.xs),
                Text(
                  sheetHint,
                  style: Theme.of(sheetContext).textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                    height: 1.35,
                  ),
                ),
                const Gap(Insets.md),
                ConstrainedBox(
                  constraints: BoxConstraints(
                    maxHeight: MediaQuery.sizeOf(sheetContext).height * 0.5,
                  ),
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: topics.length,
                    separatorBuilder: (_, __) => const Divider(
                      height: 1,
                      color: AppColors.borderHairline,
                    ),
                    itemBuilder: (_, index) {
                      final topic = topics[index];
                      return ListTile(
                        contentPadding: EdgeInsets.zero,
                        minVerticalPadding: Insets.md,
                        title: Text(
                          topic,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                        ),
                        trailing: const Icon(
                          LucideIcons.chevronRight,
                          size: 18,
                          color: AppColors.textTertiary,
                        ),
                        onTap: () => Navigator.of(sheetContext).pop(topic),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
    if (!context.mounted || selected == null) return;
    onSelect(selected);
  }
}

class AiChatDailyQuotaBanner extends StatelessWidget {
  const AiChatDailyQuotaBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.accentWash,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          Insets.screenH,
          Insets.md,
          Insets.screenH,
          Insets.md,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              dailySessionCompleteTitle,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w800,
                color: AppColors.accentDark,
              ),
            ),
            const Gap(Insets.xs),
            Text(
              dailySessionCompleteMessage,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: AppColors.textPrimary),
            ),
            const Gap(Insets.xs),
            Text(
              dailySessionCompleteHint,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.textSecondary,
                height: 1.4,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

enum TutorMascotSize { sm, lg }

class TutorMascot extends StatelessWidget {
  const TutorMascot({super.key, this.size = TutorMascotSize.lg});

  final TutorMascotSize size;

  @override
  Widget build(BuildContext context) {
    final (width, height, radius) = switch (size) {
      TutorMascotSize.sm => (46.0, 46.0, 23.0),
      TutorMascotSize.lg => (172.0, 172.0, 40.0),
    };
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        gradient: const RadialGradient(
          center: Alignment(0, -0.7),
          radius: 1.05,
          colors: [Color(0xFFFFFFFF), Color(0xFFF4F8FF), Color(0xFFE8F1FB)],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF062D63).withValues(alpha: 0.14),
            blurRadius: size == TutorMascotSize.lg ? 46 : 16,
            offset: Offset(0, size == TutorMascotSize.lg ? 20 : 6),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Image.asset(
        AppAssets.tutorMascot,
        fit: BoxFit.contain,
        filterQuality: FilterQuality.high,
        errorBuilder: (_, __, ___) => Icon(
          Icons.school_rounded,
          size: size == TutorMascotSize.lg ? 72 : 22,
          color: AppColors.primary,
        ),
      ),
    );
  }
}

/// Placeholder khi môn mới đang mở buổi chào — không dùng [LoadingSkeleton]
/// trong ListView (sẽ unbounded height, màn hình trắng).
class AiChatOpeningPlaceholder extends StatelessWidget {
  const AiChatOpeningPlaceholder({super.key});

  static const title = 'Đang chuẩn bị buổi học...';

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, Insets.xl, 0, Insets.md),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const TutorMascot(size: TutorMascotSize.lg),
          const Gap(Insets.lg),
          Text(
            title,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: AppColors.splashNavy,
            ),
          ),
          const Gap(Insets.md),
          const SizedBox(
            width: 28,
            height: 28,
            child: CircularProgressIndicator(strokeWidth: 2.6),
          ),
        ],
      ),
    );
  }
}

class AiChatPromptStarters extends StatelessWidget {
  const AiChatPromptStarters({
    super.key,
    required this.onSelect,
    this.enabled = true,
  });

  final ValueChanged<String> onSelect;
  final bool enabled;

  static const title = 'Hôm nay bạn muốn học gì?';
  static const keywordTipTitle = 'Mẹo đặt câu hỏi hiệu quả';
  static const keywordTip = AiChatInputBar.keywordTip;

  static const prompts = [
    (
      title: 'Giải thích khái niệm',
      prompt:
          'Dựa trên tài liệu môn học, hãy chọn một khái niệm nền tảng quan trọng và giải thích bằng một ví dụ đơn giản.',
      icon: LucideIcons.bookOpen,
    ),
    (
      title: 'Kiểm tra mã nguồn',
      prompt:
          'Dựa trên tài liệu môn học, hãy đưa ra một ví dụ mã nguồn tiêu biểu, sau đó phân tích cách hoạt động và những điểm có thể cải thiện.',
      icon: LucideIcons.code,
    ),
    (
      title: 'Tóm tắt bài học',
      prompt:
          'Dựa trên tài liệu môn học, hãy tóm tắt những nội dung quan trọng tôi cần ghi nhớ và gợi ý thứ tự ôn tập.',
      icon: LucideIcons.graduationCap,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, Insets.xl, 0, Insets.md),
      child: Column(
        children: [
          const TutorMascot(size: TutorMascotSize.lg),
          const Gap(Insets.lg),
          Text(
            title,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w700,
              color: AppColors.splashNavy,
            ),
          ),
          const Gap(Insets.md),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(
              Insets.md,
              Insets.sm,
              Insets.md,
              Insets.md,
            ),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF8EF),
              borderRadius: BorderRadius.circular(Radii.lg),
              border: Border.all(color: const Color(0xFFFDE7C8)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  keywordTipTitle,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: AppColors.composerKeywordTip,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const Gap(4),
                Text(
                  keywordTip,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: const Color(0xFF7C4A12),
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
          const Gap(Insets.lg),
          for (final item in prompts) ...[
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: enabled ? () => onSelect(item.prompt) : null,
                icon: Icon(item.icon, size: 16),
                label: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(item.title),
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.peacockBlue,
                  side: const BorderSide(color: AppColors.borderHairline),
                  padding: const EdgeInsets.symmetric(
                    horizontal: Insets.md,
                    vertical: Insets.md,
                  ),
                ),
              ),
            ),
            const Gap(Insets.sm),
          ],
        ],
      ),
    );
  }
}

class AiUserMessageActions extends StatelessWidget {
  const AiUserMessageActions({
    super.key,
    required this.canResend,
    required this.onCopy,
    required this.onEdit,
  });

  final bool canResend;
  final VoidCallback onCopy;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: Insets.sm),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          IconButton(
            tooltip: 'Sao chép',
            visualDensity: VisualDensity.compact,
            onPressed: onCopy,
            icon: const Icon(LucideIcons.copy, size: 16),
          ),
          IconButton(
            tooltip: 'Sửa và gửi lại',
            visualDensity: VisualDensity.compact,
            onPressed: canResend ? onEdit : null,
            icon: const Icon(LucideIcons.pencil, size: 16),
          ),
        ],
      ),
    );
  }
}

class AiChatDateSeparator extends StatelessWidget {
  const AiChatDateSeparator({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: Insets.md),
        padding: const EdgeInsets.symmetric(
          horizontal: Insets.lg,
          vertical: Insets.xs,
        ),
        decoration: BoxDecoration(
          color: AppColors.raised,
          borderRadius: BorderRadius.circular(Radii.full),
        ),
        child: Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: AppColors.textTertiary,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

class AiChatInputBar extends StatelessWidget {
  const AiChatInputBar({
    super.key,
    required this.controller,
    required this.hint,
    required this.enabled,
    required this.isPending,
    required this.onSend,
    required this.onStop,
    required this.stopLabel,
    this.focusNode,
    this.onAttach,
    this.onAttachImages,
    this.onMic,
    this.isListening = false,
    this.showComposerTips = false,
    this.attachmentNames = const [],
    this.onRemoveAttachment,
    this.codeController,
    this.codeExpanded = false,
    this.onToggleCode,
  });

  final TextEditingController controller;
  final FocusNode? focusNode;
  final String hint;
  final bool enabled;
  final bool isPending;
  final VoidCallback onSend;
  final VoidCallback onStop;
  final String stopLabel;
  final VoidCallback? onAttach;
  final VoidCallback? onAttachImages;
  final VoidCallback? onMic;
  final bool isListening;
  final bool showComposerTips;
  final List<String> attachmentNames;
  final ValueChanged<String>? onRemoveAttachment;
  final TextEditingController? codeController;
  final bool codeExpanded;
  final VoidCallback? onToggleCode;

  static const keywordTip =
      'Hãy dùng đúng từ khóa học thuật của môn (ví dụ: servlet, inheritance, JSP lifecycle, SQL join). AI Tutor tìm tài liệu theo keyword — càng cụ thể thì câu trả lời càng chính xác.';
  static const disclaimer =
      'AI Tutor có thể trả lời sai. Hãy kiểm tra lại thông tin quan trọng.';

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: Container(
        padding: const EdgeInsets.fromLTRB(
          Insets.screenH,
          Insets.lg,
          Insets.screenH,
          Insets.xxl,
        ),
        color: AppColors.card,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (attachmentNames.isNotEmpty) ...[
              Wrap(
                spacing: Insets.xs,
                runSpacing: Insets.xs,
                children: [
                  for (final name in attachmentNames)
                    InputChip(
                      label: Text(name, overflow: TextOverflow.ellipsis),
                      visualDensity: VisualDensity.compact,
                      onDeleted: onRemoveAttachment == null
                          ? null
                          : () => onRemoveAttachment!(name),
                    ),
                ],
              ),
              const Gap(Insets.sm),
            ],
            if (isListening)
              Padding(
                padding: const EdgeInsets.only(
                  bottom: Insets.xs,
                  left: Insets.md,
                ),
                child: Text(
                  'Đang nghe...',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.peacockBlue,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            if (codeController != null && codeExpanded) ...[
              TextField(
                controller: codeController,
                enabled: enabled && !isPending,
                maxLines: 8,
                minLines: 4,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  fontFamily: 'monospace',
                  color: AppColors.textPrimary,
                  height: 1.4,
                ),
                decoration: InputDecoration(
                  hintText: 'Dán mã nguồn hoặc log lỗi...',
                  filled: true,
                  fillColor: AppColors.raised,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(Radii.md),
                    borderSide: const BorderSide(
                      color: AppColors.borderHairline,
                    ),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(Radii.md),
                    borderSide: const BorderSide(
                      color: AppColors.borderHairline,
                    ),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(Radii.md),
                    borderSide: const BorderSide(color: AppColors.primaryTint),
                  ),
                  isDense: true,
                  contentPadding: const EdgeInsets.all(Insets.md),
                ),
              ),
              const Gap(Insets.sm),
            ],
            ListenableBuilder(
              listenable: Listenable.merge([
                controller,
                if (codeController != null) codeController!,
              ]),
              builder: (context, _) {
                final hasText = controller.text.trim().isNotEmpty;
                final hasCode =
                    (codeController?.text.trim().isNotEmpty ?? false);
                final showSend =
                    !isPending &&
                    (hasText || hasCode || attachmentNames.isNotEmpty);
                return Container(
                  constraints: const BoxConstraints(
                    minHeight: 72,
                    maxHeight: 148,
                  ),
                  padding: const EdgeInsets.fromLTRB(6, 8, 6, 8),
                  decoration: BoxDecoration(
                    color: AppColors.raised,
                    borderRadius: BorderRadius.circular(Radii.full),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      if (onAttach != null || onAttachImages != null)
                        _AttachPlusButton(
                          enabled: enabled && !isPending,
                          onPickFiles: onAttach,
                          onPickImages: onAttachImages,
                        ),
                      Expanded(
                        child: TextField(
                          controller: controller,
                          focusNode: focusNode,
                          enabled: enabled,
                          keyboardType: TextInputType.multiline,
                          textInputAction: TextInputAction.newline,
                          maxLines: 4,
                          minLines: 1,
                          autocorrect: VietnameseTextInput.autocorrect,
                          enableSuggestions:
                              VietnameseTextInput.enableSuggestions,
                          enableIMEPersonalizedLearning:
                              VietnameseTextInput.enableIMEPersonalizedLearning,
                          textCapitalization: TextCapitalization.none,
                          smartDashesType: VietnameseTextInput.smartDashesType,
                          smartQuotesType: VietnameseTextInput.smartQuotesType,
                          style: Theme.of(context).textTheme.bodyLarge
                              ?.copyWith(
                                color: AppColors.textPrimary,
                                fontWeight: FontWeight.w500,
                              ),
                          decoration: InputDecoration(
                            hintText: hint,
                            hintStyle: Theme.of(context).textTheme.bodyLarge
                                ?.copyWith(
                                  color: AppColors.textTertiary,
                                  fontWeight: FontWeight.w400,
                                ),
                            filled: false,
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            disabledBorder: InputBorder.none,
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: Insets.sm,
                              vertical: 16,
                            ),
                          ),
                        ),
                      ),
                      if (onToggleCode != null)
                        _ComposerCircleButton(
                          tooltip: codeExpanded
                              ? 'Ẩn ô dán mã nguồn'
                              : 'Dán mã nguồn',
                          icon: LucideIcons.code,
                          iconColor: codeExpanded || hasCode
                              ? AppColors.primaryTint
                              : AppColors.peacockBlue,
                          onTap: enabled && !isPending ? onToggleCode : null,
                          filled: codeExpanded || hasCode,
                        ),
                      if (onMic != null)
                        _ComposerCircleButton(
                          tooltip: isListening
                              ? 'Dừng nhập giọng nói'
                              : 'Nhập bằng giọng nói',
                          icon: isListening
                              ? LucideIcons.micOff
                              : LucideIcons.mic,
                          iconColor: isListening
                              ? AppColors.error
                              : AppColors.peacockBlue,
                          onTap: enabled && !isPending ? onMic : null,
                          filled: false,
                        ),
                      if (isPending)
                        _ChatInputActionPill(
                          label: stopLabel,
                          icon: LucideIcons.square,
                          backgroundColor: AppColors.card,
                          foregroundColor: AppColors.textPrimary,
                          onTap: onStop,
                        )
                      else if (showSend)
                        _SendCircleButton(
                          enabled: enabled,
                          onTap: enabled ? onSend : null,
                        ),
                    ],
                  ),
                );
              },
            ),
            if (showComposerTips) ...[
              const Gap(Insets.sm),
              Text(
                keywordTip,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: AppColors.composerKeywordTip,
                  height: 1.35,
                ),
              ),
              const Gap(4),
              Text(
                disclaimer,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: AppColors.composerMeta,
                  height: 1.35,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class AiChatLoadingSteps extends StatefulWidget {
  const AiChatLoadingSteps({super.key});

  static const steps = [
    'Đang đọc câu hỏi',
    'Đang tìm trong tài liệu môn học',
    'Đang soạn câu trả lời',
  ];
  static const takingLonger =
      'Yêu cầu đang mất thêm thời gian để truy xuất và kiểm tra tài liệu môn học.';
  static const preparing = 'AI Tutor đang chuẩn bị câu trả lời.';

  @override
  State<AiChatLoadingSteps> createState() => _AiChatLoadingStepsState();
}

class _AiChatLoadingStepsState extends State<AiChatLoadingSteps> {
  var _stepIndex = 0;
  var _takingLonger = false;
  Timer? _stepTimer;
  Timer? _fallbackTimer;

  @override
  void initState() {
    super.initState();
    _stepTimer = Timer.periodic(const Duration(milliseconds: 2200), (_) {
      if (!mounted) return;
      setState(() {
        _stepIndex = (_stepIndex + 1).clamp(
          0,
          AiChatLoadingSteps.steps.length - 1,
        );
      });
    });
    _fallbackTimer = Timer(const Duration(seconds: 10), () {
      if (!mounted) return;
      setState(() => _takingLonger = true);
    });
  }

  @override
  void dispose() {
    _stepTimer?.cancel();
    _fallbackTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: Insets.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
              const Gap(Insets.sm),
              Expanded(
                child: Text(
                  AiChatLoadingSteps.steps[_stepIndex],
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const Gap(Insets.xs),
          Text(
            _takingLonger
                ? AiChatLoadingSteps.takingLonger
                : AiChatLoadingSteps.preparing,
            style: Theme.of(
              context,
            ).textTheme.labelSmall?.copyWith(color: AppColors.textTertiary),
          ),
          const Gap(Insets.sm),
          _MarkdownSkeleton(),
        ],
      ),
    );
  }
}

class _MarkdownSkeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _skeletonLine(0.92),
        const Gap(6),
        _skeletonLine(0.74),
        const Gap(6),
        _skeletonLine(0.48),
      ],
    );
  }

  Widget _skeletonLine(double widthFactor) {
    return FractionallySizedBox(
      widthFactor: widthFactor,
      child: Container(
        height: 8,
        decoration: BoxDecoration(
          color: AppColors.raised,
          borderRadius: BorderRadius.circular(Radii.full),
        ),
      ),
    );
  }
}

class _AttachPlusButton extends StatefulWidget {
  const _AttachPlusButton({
    required this.enabled,
    this.onPickFiles,
    this.onPickImages,
  });

  final bool enabled;
  final VoidCallback? onPickFiles;
  final VoidCallback? onPickImages;

  @override
  State<_AttachPlusButton> createState() => _AttachPlusButtonState();
}

class _AttachPlusButtonState extends State<_AttachPlusButton> {
  final _layerLink = LayerLink();
  OverlayEntry? _entry;

  @override
  void dispose() {
    _removeMenu();
    super.dispose();
  }

  void _removeMenu() {
    _entry?.remove();
    _entry = null;
  }

  void _toggleMenu() {
    if (_entry != null) {
      _removeMenu();
      return;
    }

    final overlay = Overlay.of(context, rootOverlay: true);
    _entry = OverlayEntry(
      builder: (overlayContext) {
        return Stack(
          children: [
            Positioned.fill(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: _removeMenu,
              ),
            ),
            CompositedTransformFollower(
              link: _layerLink,
              showWhenUnlinked: false,
              targetAnchor: Alignment.topLeft,
              followerAnchor: Alignment.bottomLeft,
              offset: const Offset(0, -8),
              child: _AttachOverlayCard(
                onCamera: widget.onPickImages,
                onPhoto: widget.onPickImages,
                onFile: widget.onPickFiles,
                onSelect: _removeMenu,
              ),
            ),
          ],
        );
      },
    );
    overlay.insert(_entry!);
  }

  @override
  Widget build(BuildContext context) {
    return CompositedTransformTarget(
      link: _layerLink,
      child: _ComposerCircleButton(
        tooltip: 'Thêm tệp',
        icon: LucideIcons.plus,
        onTap: widget.enabled ? _toggleMenu : null,
        filled: false,
      ),
    );
  }
}

class _AttachOverlayCard extends StatelessWidget {
  const _AttachOverlayCard({
    this.onCamera,
    this.onPhoto,
    this.onFile,
    required this.onSelect,
  });

  final VoidCallback? onCamera;
  final VoidCallback? onPhoto;
  final VoidCallback? onFile;
  final VoidCallback onSelect;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.inverse,
      elevation: 12,
      shadowColor: AppColors.primaryDark.withValues(alpha: 0.4),
      borderRadius: BorderRadius.circular(Radii.xl),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: Insets.sm,
          vertical: Insets.sm,
        ),
        child: IntrinsicWidth(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (onCamera != null)
                _AttachOverlayRow(
                  icon: LucideIcons.camera,
                  label: 'Camera',
                  onTap: () {
                    onSelect();
                    onCamera!();
                  },
                ),
              if (onPhoto != null)
                _AttachOverlayRow(
                  icon: LucideIcons.image,
                  label: 'Ảnh',
                  onTap: () {
                    onSelect();
                    onPhoto!();
                  },
                ),
              if (onFile != null)
                _AttachOverlayRow(
                  icon: LucideIcons.paperclip,
                  label: 'Tệp',
                  onTap: () {
                    onSelect();
                    onFile!();
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AttachOverlayRow extends StatelessWidget {
  const _AttachOverlayRow({
    required this.icon,
    required this.label,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: onTap != null,
      label: label,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(Radii.lg),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: Insets.xs,
              vertical: Insets.xs,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: const BoxDecoration(
                    color: AppColors.primaryTint,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(icon, size: 18, color: Colors.white),
                ),
                const Gap(Insets.md),
                Text(
                  label,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w500,
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

class _ComposerCircleButton extends StatelessWidget {
  const _ComposerCircleButton({
    required this.tooltip,
    required this.icon,
    this.onTap,
    this.iconColor = AppColors.peacockBlue,
    this.filled = true,
  });

  final String tooltip;
  final IconData icon;
  final VoidCallback? onTap;
  final Color iconColor;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: filled ? AppColors.raised : Colors.transparent,
        shape: const CircleBorder(),
        child: InkWell(
          onTap: onTap,
          customBorder: const CircleBorder(),
          child: SizedBox(
            width: 48,
            height: 48,
            child: Icon(icon, size: 22, color: iconColor),
          ),
        ),
      ),
    );
  }
}

class _SendCircleButton extends StatelessWidget {
  const _SendCircleButton({required this.enabled, this.onTap});

  final bool enabled;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: enabled,
      label: 'Gửi',
      child: Tooltip(
        message: 'Gửi',
        child: Material(
          color: enabled ? AppColors.primary : AppColors.borderHairline,
          shape: const CircleBorder(),
          child: InkWell(
            onTap: onTap,
            customBorder: const CircleBorder(),
            child: const SizedBox(
              width: 48,
              height: 48,
              child: Center(
                child: ExcludeSemantics(
                  child: FaIcon(
                    FontAwesomeIcons.solidPaperPlane,
                    size: 16,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ChatInputActionPill extends StatelessWidget {
  const _ChatInputActionPill({
    this.label,
    required this.icon,
    required this.backgroundColor,
    required this.foregroundColor,
    this.onTap,
  });

  final String? label;
  final IconData icon;
  final Color backgroundColor;
  final Color foregroundColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: backgroundColor,
      borderRadius: BorderRadius.circular(Radii.full),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(Radii.full),
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: label != null ? Insets.md : Insets.sm + 2,
            vertical: Insets.sm,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (label != null) ...[
                Text(
                  label!,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: foregroundColor,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Gap(Insets.xs),
              ],
              Icon(icon, size: 18, color: foregroundColor),
            ],
          ),
        ),
      ),
    );
  }
}

class AiChatReviewBar extends StatelessWidget {
  const AiChatReviewBar({
    super.key,
    required this.ratingPrompt,
    required this.reportLabel,
    required this.onRatingSelected,
    required this.onReport,
    this.onCopy,
    this.onPin,
    this.isPinned = false,
    this.canPin = true,
    this.reviewSubmitted = false,
    this.reviewSubmittedLabel,
  });

  final String ratingPrompt;
  final String reportLabel;
  final ValueChanged<int>? onRatingSelected;
  final VoidCallback? onReport;
  final VoidCallback? onCopy;
  final VoidCallback? onPin;
  final bool isPinned;
  final bool canPin;
  final bool reviewSubmitted;
  final String? reviewSubmittedLabel;

  @override
  Widget build(BuildContext context) {
    if (reviewSubmitted) {
      return Padding(
        padding: const EdgeInsets.only(left: 44, bottom: Insets.sm),
        child: Row(
          children: [
            const Icon(
              LucideIcons.checkCircle2,
              size: 14,
              color: AppColors.success,
            ),
            const Gap(Insets.xs),
            Text(
              reviewSubmittedLabel ?? 'Đã gửi phản hồi',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: AppColors.textTertiary),
            ),
          ],
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(left: 44, bottom: Insets.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (onCopy != null) ...[
                _IconBtn(icon: LucideIcons.copy, onTap: onCopy!),
                const Gap(Insets.xs),
              ],
              if (onPin != null && canPin) ...[
                _IconBtn(
                  icon: isPinned ? LucideIcons.pinOff : LucideIcons.pin,
                  onTap: onPin!,
                  color: isPinned ? AppColors.primary : null,
                ),
                const Gap(Insets.xs),
              ],
              const Spacer(),
              GestureDetector(
                onTap: onReport,
                child: Text(
                  '⚑ $reportLabel',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textTertiary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const Gap(Insets.xs),
          Row(
            children: [
              Text(
                ratingPrompt,
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: AppColors.textTertiary),
              ),
              const Gap(Insets.sm),
              ...List.generate(5, (index) {
                final star = index + 1;
                return Padding(
                  padding: EdgeInsets.only(right: index == 4 ? 0 : Insets.xs),
                  child: InkWell(
                    onTap: onRatingSelected == null
                        ? null
                        : () => onRatingSelected!(star),
                    borderRadius: BorderRadius.circular(Radii.sm),
                    child: Padding(
                      padding: const EdgeInsets.all(2),
                      child: Icon(
                        LucideIcons.star,
                        size: 18,
                        color: onRatingSelected == null
                            ? AppColors.warm300.withValues(alpha: 0.5)
                            : AppColors.warm300,
                      ),
                    ),
                  ),
                );
              }),
            ],
          ),
        ],
      ),
    );
  }
}

class _IconBtn extends StatelessWidget {
  const _IconBtn({required this.icon, required this.onTap, this.color});

  final IconData icon;
  final VoidCallback onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(Radii.sm),
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: AppColors.raised,
          borderRadius: BorderRadius.circular(Radii.sm),
        ),
        child: Icon(icon, size: 16, color: color ?? AppColors.textSecondary),
      ),
    );
  }
}

class AiMessageRow extends StatelessWidget {
  const AiMessageRow({super.key, required this.isUser, required this.child});

  final bool isUser;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (isUser) {
      return Align(alignment: Alignment.centerRight, child: child);
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(right: Insets.sm, top: Insets.xs),
          child: TutorMascot(size: TutorMascotSize.sm),
        ),
        const Gap(Insets.sm),
        Expanded(child: child),
      ],
    );
  }
}
