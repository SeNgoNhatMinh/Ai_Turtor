import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:gap/gap.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/constants/app_assets.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radius.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_tokens.dart';
import '../../../../core/utils/vietnamese_text_input.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../shared/widgets/widgets.dart';

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
  const AnswerReviewFeedbackResult({
    this.feedback,
    this.suggestedCorrection,
  });

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

class _AnswerReviewFeedbackSheetState extends State<_AnswerReviewFeedbackSheet> {
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
            Text(
              widget.title,
              style: Theme.of(context).textTheme.titleMedium,
            ),
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
    this.onCourseTap,
    this.onHistoryTap,
  });

  final String courseCode;
  final VoidCallback? onCourseTap;
  final VoidCallback? onHistoryTap;

  @override
  Size get preferredSize => const Size.fromHeight(64);

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return AppBar(
      backgroundColor: AppColors.card,
      elevation: 0,
      scrolledUnderElevation: 0,
      // Không có nút back: giống ChatGPT, đây là màn hình chính của tab —
      // muốn xem đoạn chat khác thì mở sidebar (icon panelLeft bên dưới).
      automaticallyImplyLeading: false,
      titleSpacing: Insets.screenH,
      title: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: AppColors.primaryWash,
              borderRadius: BorderRadius.circular(Radii.md),
            ),
            child: Image.asset(
              AppAssets.cocVangLogo,
              fit: BoxFit.contain,
              errorBuilder: (_, __, ___) => const Icon(
                Icons.school_rounded,
                size: 24,
                color: AppColors.primary,
              ),
            ),
          ),
          const Gap(Insets.xs),
          AiLanguageHintButton(tooltip: l10n.aiLanguageHintTooltip),
          const Gap(Insets.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.aiTutorName,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: AppColors.splashNavy,
                    fontSize: 16,
                  ),
                ),
                Row(
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration: const BoxDecoration(
                        color: AppColors.leafGreen,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const Gap(Insets.xs),
                    Text(
                      'Trực tuyến',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textTertiary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
      actions: [
        if (onHistoryTap != null)
          IconButton(
            tooltip: 'Lịch sử hội thoại',
            onPressed: onHistoryTap,
            icon: const Icon(
              LucideIcons.panelLeft,
              color: AppColors.textSecondary,
            ),
          ),
        GestureDetector(
          onTap: onCourseTap,
          child: Container(
            margin: const EdgeInsets.only(right: Insets.lg),
            padding: const EdgeInsets.symmetric(
              horizontal: Insets.md,
              vertical: 7,
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
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
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
      ],
      bottom: const PreferredSize(
        preferredSize: Size.fromHeight(1),
        child: Divider(height: 1, color: AppColors.borderHairline),
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
  });

  final TextEditingController controller;
  final String hint;
  final bool enabled;
  final bool isPending;
  final VoidCallback onSend;
  final VoidCallback onStop;
  final String stopLabel;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: Container(
      padding: const EdgeInsets.fromLTRB(
        Insets.screenH,
        Insets.sm,
        Insets.screenH,
        Insets.lg,
      ),
      decoration: const BoxDecoration(
        color: AppColors.card,
        border: Border(top: BorderSide(color: AppColors.borderHairline)),
        boxShadow: [
          BoxShadow(
            color: Color(0x08000000),
            blurRadius: 8,
            offset: Offset(0, -2),
          ),
        ],
      ),
      child: Container(
        constraints: const BoxConstraints(minHeight: 52, maxHeight: 120),
        padding: const EdgeInsets.all(Insets.xs),
        decoration: BoxDecoration(
          color: AppColors.raised,
          borderRadius: BorderRadius.circular(Radii.full),
          border: Border.all(color: AppColors.borderHairline),
        ),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                enabled: enabled,
                keyboardType: TextInputType.multiline,
                textInputAction: TextInputAction.newline,
                maxLines: 4,
                minLines: 1,
                autocorrect: VietnameseTextInput.autocorrect,
                enableSuggestions: VietnameseTextInput.enableSuggestions,
                enableIMEPersonalizedLearning:
                    VietnameseTextInput.enableIMEPersonalizedLearning,
                textCapitalization: TextCapitalization.none,
                smartDashesType: VietnameseTextInput.smartDashesType,
                smartQuotesType: VietnameseTextInput.smartQuotesType,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w500,
                ),
                decoration: InputDecoration(
                  hintText: hint,
                  hintStyle: Theme.of(context).textTheme.bodyLarge?.copyWith(
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
                    horizontal: Insets.md,
                    vertical: Insets.sm,
                  ),
                ),
              ),
            ),
            if (isPending)
              _ChatInputActionPill(
                label: stopLabel,
                icon: LucideIcons.square,
                backgroundColor: AppColors.card,
                foregroundColor: AppColors.textPrimary,
                onTap: onStop,
              )
            else
              _ChatInputActionPill(
                icon: LucideIcons.send,
                backgroundColor:
                    enabled ? AppColors.primary : AppColors.borderHairline,
                foregroundColor:
                    enabled ? AppColors.onOrange : AppColors.textDisabled,
                onTap: enabled ? onSend : null,
              ),
          ],
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
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textTertiary,
                  ),
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
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.textTertiary,
                    ),
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
        Container(
          width: 32,
          height: 32,
          margin: const EdgeInsets.only(right: Insets.sm, top: Insets.xs),
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            color: AppColors.primaryWash,
            borderRadius: BorderRadius.circular(Radii.sm),
          ),
          child: Image.asset(
            AppAssets.cocVangLogo,
            fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => const Icon(
              Icons.school_rounded,
              size: 18,
              color: AppColors.primary,
            ),
          ),
        ),
        Expanded(child: child),
      ],
    );
  }
}

